const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Caminhos dos arquivos
const mdPath = path.join(__dirname, 'casa-no-controle-manual.md');
const pdfPath = path.join(__dirname, 'Casa_no_Controle_Manual.pdf');

if (!fs.existsSync(mdPath)) {
  console.error('Erro: casa-no-controle-manual.md não encontrado!');
  process.exit(1);
}

// Lendo o conteúdo do manual
const content = fs.readFileSync(mdPath, 'utf8');
const lines = content.split(/\r?\n/);

// Inicializando o documento PDF (tamanho Letter, com buffer de páginas para adicionar cabeçalhos/rodapés depois)
const doc = new PDFDocument({
  size: 'letter',
  margins: { top: 65, bottom: 70, left: 50, right: 50 },
  bufferPages: true
});

// Canalizando o fluxo para o arquivo final
const writeStream = fs.createWriteStream(pdfPath);
doc.pipe(writeStream);

// ----------------------------------------------------
// HELPER: INLINE MARKDOWN PARSER (BOLD & ITALIC)
// ----------------------------------------------------
const writeParagraph = (text, font, size, color, options = {}, x = null, y = null) => {
  doc.fontSize(size).fillColor(color);
  
  // Limpa marcações markdown de cabeçalhos que possam vazar em blockquotes/tabelas
  let cleanText = text.replace(/^#+\s+/, '').trim();
  
  // Dividir por negrito do markdown (**texto**)
  const boldParts = cleanText.split('**');
  let isFirstSegment = true;
  
  boldParts.forEach((bPart, bIndex) => {
    const isBold = bIndex % 2 !== 0;
    
    // Dividir por itálico do markdown (*texto*)
    const italicParts = bPart.split('*');
    italicParts.forEach((iPart, iIndex) => {
      const isItalic = iIndex % 2 !== 0;
      
      // Mapear família da fonte correspondente
      let fontName = font;
      if (font === 'Helvetica') {
        if (isBold && isItalic) fontName = 'Helvetica-BoldOblique';
        else if (isBold) fontName = 'Helvetica-Bold';
        else if (isItalic) fontName = 'Helvetica-Oblique';
        else fontName = 'Helvetica';
      } else if (font === 'Times-Roman') {
        if (isBold && isItalic) fontName = 'Times-BoldItalic';
        else if (isBold) fontName = 'Times-Bold';
        else if (isItalic) fontName = 'Times-Italic';
        else fontName = 'Times-Roman';
      }
      
      doc.font(fontName);
      
      // Verifica se é o último pedaço do texto
      const isLast = (bIndex === boldParts.length - 1) && (iIndex === italicParts.length - 1);
      
      let textOpts = { ...options, continued: !isLast };
      
      if (isFirstSegment) {
        isFirstSegment = false;
        if (x !== null && y !== null) {
          doc.text(iPart, x, y, textOpts);
        } else {
          doc.text(iPart, textOpts);
        }
      } else {
        doc.text(iPart, textOpts);
      }
    });
  });
};

// ----------------------------------------------------
// 1. CAPA DO MANUAL (DESIGN PREMIUM)
// ----------------------------------------------------
// Renderiza a imagem capa.png preenchendo toda a primeira página do PDF
try {
  doc.image('capa.png', 0, 0, { width: 612, height: 792 });
} catch (err) {
  console.error("Erro ao carregar a imagem da capa:", err);
  // Fallback: desenha um fundo escuro simples para não quebrar a compilação
  doc.rect(0, 0, 612, 792).fill('#0f2e2e');
}

// Quebra de página para iniciar o livro
doc.addPage();

// Setando coordenadas iniciais de fluxo de texto
doc.x = 50;

// ----------------------------------------------------
// 2. PARSER DO CONTEÚDO MARKDOWN PARA PDF
// ----------------------------------------------------
let inTable = false;
let tableRows = [];
let inBlockquote = false;
let blockquoteText = [];
let inCodeBlock = false;
let codeBlockText = [];
let accumulatedPara = [];
let firstHeading = true; // Flag para controlar quebras de página automáticas nas seções

const checkPageWrap = (neededHeight) => {
  if (doc.y > doc.page.height - doc.page.margins.bottom - neededHeight) {
    doc.addPage();
    doc.x = 50; // Garante que a nova página comece na margem esquerda
    return true;
  }
  return false;
};

const flushParagraph = (nextIsCTA = false) => {
  if (accumulatedPara.length > 0) {
    const fullText = accumulatedPara.join(' ');
    
    // Regra lookahead: se o próximo item for o bloco "AGORA É COM VOCÊ",
    // precisamos de espaço suficiente na página para renderizar AMBOS (parágrafo + caixa CTA).
    // Isso evita que o bloco de ação fique isolado sozinho no topo de uma página em branco.
    const neededHeight = nextIsCTA ? 125 : 35;
    
    checkPageWrap(neededHeight);
    
    // Fonte tamanho 13 e lineGap 4.5 para conforto de leitura do público 40+
    writeParagraph(fullText, 'Helvetica', 13, '#2b3a3a', { align: 'justify', lineGap: 4.5 });
    doc.y += 10;
    accumulatedPara = [];
  }
};

const renderBlockquote = () => {
  if (blockquoteText.length === 0) return;
  
  // Respiro superior (margin-top) para evitar sobreposição com elementos anteriores
  doc.y += 16;
  
  const fullText = blockquoteText.join('\n');
  const boxWidth = 512;
  
  doc.font('Helvetica-Oblique').fontSize(12.5); // Aumentado para 12.5pt
  const textHeight = doc.heightOfString(fullText, { width: boxWidth - 30, lineGap: 3.5 });
  const boxHeight = textHeight + 20;

  checkPageWrap(boxHeight + 10);

  const startY = doc.y;
  
  // Caixa de fundo areia suave
  doc.rect(50, startY, boxWidth, boxHeight).fill('#f4f4f0');
  
  // Borda esquerda laranja terracota
  doc.rect(50, startY, 4, boxHeight).fill('#d97706');

  // Texto (Tamanho 12.5)
  writeParagraph(fullText, 'Helvetica', 12.5, '#2b3a3a', { width: boxWidth - 30, lineGap: 3.5 }, 65, startY + 10);

  doc.y = startY + boxHeight + 15;
  doc.x = 50; // IMPORTANTE: Reseta o cursor X para a margem esquerda!
  blockquoteText = [];
};

const renderCallToActionBox = (text) => {
  // Respiro superior (margin-top) para evitar sobreposição
  doc.y += 16;
  
  const boxWidth = 512;
  
  doc.font('Helvetica-Bold').fontSize(12.5); // Aumentado para 12.5pt
  const textHeight = doc.heightOfString(text.trim(), { width: boxWidth - 30, lineGap: 4 });
  const boxHeight = textHeight + 20;
  
  checkPageWrap(boxHeight + 15);
  const startY = doc.y;
  
  // Fundo amarelo/ouro muito claro
  doc.rect(50, startY, boxWidth, boxHeight).fill('#fffbeb');
  // Borda ouro claro
  doc.rect(50, startY, boxWidth, boxHeight).strokeColor('#fde68a').lineWidth(1).stroke();
  // Barra esquerda laranja terracota
  doc.rect(50, startY, 4, boxHeight).fill('#d97706');
  
  // Escreve com cor quente escura (Tamanho 12.5)
  writeParagraph(text.trim(), 'Helvetica', 12.5, '#9a3412', { width: boxWidth - 30, lineGap: 4 }, 65, startY + 10);
  
  doc.y = startY + boxHeight + 18;
  doc.x = 50; // IMPORTANTE: Reseta o cursor X para a margem esquerda!
};

const renderCodeBlock = () => {
  if (codeBlockText.length === 0) return;
  
  // Respiro superior
  doc.y += 16;
  
  const fullText = codeBlockText.join('\n');
  const boxWidth = 512;
  
  doc.font('Helvetica').fontSize(11); // Aumentado para 11pt
  const textHeight = doc.heightOfString(fullText, { width: boxWidth - 20, lineGap: 3.5 });
  const boxHeight = textHeight + 16;
  
  checkPageWrap(boxHeight + 10);
  const startY = doc.y;
  
  // Fundo cinza suave e borda
  doc.rect(50, startY, boxWidth, boxHeight).fill('#f8fafc');
  doc.rect(50, startY, boxWidth, boxHeight).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
  
  // Renderizar o texto com fonte limpa
  doc.font('Helvetica').fontSize(11).fillColor('#334155');
  doc.text(fullText, 60, startY + 8, { width: boxWidth - 20, lineGap: 3.5 });
  
  doc.y = startY + boxHeight + 15;
  doc.x = 50; // IMPORTANTE: Reseta o cursor X para a margem esquerda!
  codeBlockText = [];
};

const getRowHeight = (row, colWidths, isHeader = false) => {
  let maxCellHeight = 24; // Aumentado devido ao tamanho de fonte 11pt
  doc.fontSize(11);
  row.forEach((cell, cellIndex) => {
    doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
    const cellHeight = doc.heightOfString(cell.trim(), { width: colWidths[cellIndex] - 10 });
    if (cellHeight + 12 > maxCellHeight) {
      maxCellHeight = cellHeight + 12;
    }
  });
  return maxCellHeight;
};

const drawTableRow = (row, rowIndex, maxCellHeight, colWidths, isExampleTable) => {
  const startY = doc.y;
  let startX = 50;

  row.forEach((cell, cellIndex) => {
    const w = colWidths[cellIndex];
    
    // Cores de fundo e borda com diferenciação clara EXEMPLO vs MODELO EM BRANCO
    if (rowIndex === 0) {
      // Cabeçalho da tabela
      doc.rect(startX, startY, w, maxCellHeight).fill(isExampleTable ? '#113a3a' : '#1a4545');
      doc.fillColor('#ffffff');
    } else {
      // Linhas de dados
      if (isExampleTable) {
        // Fundo eucalipto suave uniforme para exemplos
        doc.rect(startX, startY, w, maxCellHeight).fill('#f4f7f6');
        doc.fillColor('#2b3a3a');
      } else {
        // Alternado off-white / branco para templates em branco
        const fillBg = rowIndex % 2 === 0 ? '#fbfbf9' : '#ffffff';
        doc.rect(startX, startY, w, maxCellHeight).fill(fillBg);
        doc.fillColor('#2b3a3a');
      }
    }

    // Linhas da grade (tabela de exemplo usa borda levemente esverdeada)
    const borderCol = isExampleTable ? '#cbdad9' : '#e2e8f0';
    doc.rect(startX, startY, w, maxCellHeight).strokeColor(borderCol).lineWidth(0.5).stroke();

    // Escrever o texto da célula centralizado verticalmente
    const textH = doc.heightOfString(cell.trim(), { width: w - 10 });
    const textY = startY + (maxCellHeight - textH) / 2;
    
    const textColor = rowIndex === 0 ? '#ffffff' : '#2b3a3a';
    const fontName = rowIndex === 0 ? 'Helvetica-Bold' : 'Helvetica';
    
    // Font size is 11pt now for data cells and headers!
    writeParagraph(cell.trim(), fontName, 11, textColor, { width: w - 10, align: 'left' }, startX + 5, textY);

    startX += w;
  });

  doc.y = startY + maxCellHeight;
};

const renderTable = () => {
  if (tableRows.length === 0) return;

  // Respiro superior (margin-top) antes do desenho das tabelas
  doc.y += 16;

  const numCols = tableRows[0].length;
  const tableWidth = 512;
  const isExampleTable = tableRows[0].some(cell => cell.toLowerCase().includes('exemplo'));
  
  // Larguras de colunas balanceadas para acomodar fonte de 11pt e evitar quebras indesejadas
  let colWidths = [];
  if (numCols === 6) {
    const isDesperdicios = tableRows[0][0].toLowerCase().includes('ralo') || tableRows[0][0].toLowerCase().includes('exemplo');
    if (isDesperdicios) {
      colWidths = [135, 65, 65, 65, 65, 117];
    } else {
      colWidths = [50, 140, 80, 60, 85, 97];
    }
  } else if (numCols === 4) {
    colWidths = [170, 80, 110, 152];
  } else if (numCols === 3) {
    colWidths = [190, 170, 152];
  } else if (numCols === 5) {
    colWidths = [130, 80, 95, 95, 112];
  } else {
    for (let i = 0; i < numCols; i++) colWidths.push(tableWidth / numCols);
  }

  const headerRow = tableRows[0];
  const headerHeight = getRowHeight(headerRow, colWidths, true);

  tableRows.forEach((row, rowIndex) => {
    const maxCellHeight = getRowHeight(row, colWidths, rowIndex === 0);
    
    let wrapped = false;
    if (rowIndex === 0) {
      // No primeiro registro (cabeçalho), garantimos que caiba ele E a primeira linha de dados!
      // Isso evita que o cabeçalho fique órfão sozinho na página anterior.
      const nextRow = tableRows[1];
      const nextRowHeight = nextRow ? getRowHeight(nextRow, colWidths, false) : 0;
      checkPageWrap(maxCellHeight + nextRowHeight + 10);
    } else {
      // Para as linhas subsequentes, se ocorrer quebra, re-desenhamos o cabeçalho no topo da nova página
      wrapped = checkPageWrap(maxCellHeight + 5);
    }

    if (wrapped && rowIndex > 0) {
      // Repete o cabeçalho no topo da nova página se quebrou no meio da tabela
      drawTableRow(headerRow, 0, headerHeight, colWidths, isExampleTable);
    }

    drawTableRow(row, rowIndex, maxCellHeight, colWidths, isExampleTable);
  });

  doc.y += 10;
  doc.x = 50; // IMPORTANTE: Reseta o cursor X para a margem esquerda!
  tableRows = [];
};

// Iterar por todas as linhas do Markdown
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  // Fechamentos ao ler linhas em branco ou regras
  if (line === '' || line === '---' || line.match(/^\|?\s*:?-+:?\s*\|/)) {
    if (line === '') {
      if (inBlockquote) {
        renderBlockquote();
        inBlockquote = false;
      }
      if (inTable) {
        renderTable();
        inTable = false;
      }
      
      // Lookahead para ver se a próxima linha útil do manual é o bloco "AGORA É COM VOCÊ"
      let nextLineIsCTA = false;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLineClean = lines[j].trim();
        if (nextLineClean !== '') {
          if (nextLineClean.startsWith('**AGORA É COM VOCÊ:**')) {
            nextLineIsCTA = true;
          }
          break;
        }
      }
      
      flushParagraph(nextLineIsCTA);
    }
    continue;
  }

  // Detecta se saiu de um bloco de citação para texto
  if (inBlockquote && !line.startsWith('>')) {
    renderBlockquote();
    inBlockquote = false;
  }

  // Detecta se saiu de uma tabela para texto
  if (inTable && !line.startsWith('|')) {
    renderTable();
    inTable = false;
  }
  
  // Detecta blocos de código
  if (line.startsWith('```')) {
    if (inCodeBlock) {
      renderCodeBlock();
      inCodeBlock = false;
    } else {
      flushParagraph();
      inCodeBlock = true;
    }
    continue;
  }

  if (inCodeBlock) {
    codeBlockText.push(line);
    continue;
  }

  // 1. Detecção da Caixa Destacada "AGORA É COM VOCÊ"
  if (line.startsWith('**AGORA É COM VOCÊ:**')) {
    flushParagraph(true); // Pass true
    renderCallToActionBox(line);
    continue;
  }

  // 2. Linha de Tabela Markdown (| col1 | col2 |)
  if (line.startsWith('|')) {
    if (!inTable) {
      flushParagraph();
      inTable = true;
    }
    const cols = line.split('|').slice(1, -1);
    tableRows.push(cols);
    continue;
  }

  // 3. Linha de Bloco de Alerta (> ...)
  if (line.startsWith('>')) {
    flushParagraph();
    inBlockquote = true;
    let cleanLine = line.replace(/^>\s*/, '');
    cleanLine = cleanLine.replace(/\[\!NOTE\]|\[\!WARNING\]|\[\!IMPORTANT\]|\[\!CAUTION\]|\[\!TIP\]/gi, '');
    blockquoteText.push(cleanLine.trim());
    continue;
  }

  // 4. Títulos de Seção Principais (H2 no Markdown: "## SEÇÃO ...")
  if (line.startsWith('## ')) {
    flushParagraph();
    const titleText = line.substring(3);
    if (titleText.startsWith('O Método Prático')) continue; // Capa
    
    const startPage = doc.bufferedPageRange().count;
    
    if (firstHeading) {
      firstHeading = false;
    } else {
      checkPageWrap(180); // Quebra de página condicional se houver menos de 180pt disponíveis
    }
    
    // Se continuou na mesma página (não quebrou), aplica margem-top de respiro
    if (doc.bufferedPageRange().count === startPage) {
      doc.y += 24;
    } else {
      doc.y += 10;
    }
    
    // Log dinâmico das páginas para o Sumário
    console.log(`HEADING H2: ${titleText} landed on page: ${doc.bufferedPageRange().count}`);
    
    // Títulos de seção grandes (22pt) conforme solicitado para legibilidade
    writeParagraph(titleText, 'Times-Roman', 22, '#0f2e2e', { lineGap: 6 });
    
    // Desenha linha dourada elegante embaixo do título
    const underlineY = doc.y + 4;
    doc.moveTo(50, underlineY)
       .lineTo(150, underlineY)
       .strokeColor('#d97706')
       .lineWidth(2)
       .stroke();
    
    doc.y += 20;
    doc.x = 50;
    continue;
  }

  // 5. Títulos menores (H3: "### Título") - Subtítulos internos importantes (Forçado Helvetica-Bold e 15.5pt)
  if (line.startsWith('### ')) {
    flushParagraph();
    const titleText = line.substring(4);
    checkPageWrap(65);
    
    // Espaçamento H3 (24pt top / 12pt bottom) e Helvetica-Bold
    doc.y += 24;
    writeParagraph(titleText, 'Helvetica-Bold', 15.5, '#1a4545');
    doc.y += 12;
    doc.x = 50;
    continue;
  }

  // 6. Títulos H4 ("#### Título") - Subtítulos secundários ou cálculos (Forçado Helvetica-Bold e 13.5pt)
  if (line.startsWith('#### ')) {
    flushParagraph();
    const titleText = line.substring(5);
    checkPageWrap(55);
    
    // Espaçamento H4 (18pt top / 10pt bottom) e Helvetica-Bold
    doc.y += 18;
    writeParagraph(titleText, 'Helvetica-Bold', 13.5, '#2b3a3a');
    doc.y += 10;
    doc.x = 50;
    continue;
  }

  // 7. Lista de Marcadores (* ou -)
  if (line.startsWith('* ') || line.startsWith('- ')) {
    flushParagraph();
    const listText = line.substring(2);
    checkPageWrap(24); // Aumentado para 24
    
    writeParagraph('•  ' + listText, 'Helvetica', 12, '#2b3a3a', { indent: 12, align: 'justify', lineGap: 4 }); // Aumentado para 12pt e lineGap 4
    doc.y += 4;
    doc.x = 50;
    continue;
  }

  // 8. Lista Numérica (Ex: 1. Item)
  const numListMatch = line.match(/^(\d+)\.\s(.*)/);
  if (numListMatch) {
    flushParagraph();
    const num = numListMatch[1];
    const text = numListMatch[2];
    checkPageWrap(24); // Aumentado para 24
    
    writeParagraph(`${num}.  ${text}`, 'Helvetica', 12, '#2b3a3a', { indent: 12, align: 'justify', lineGap: 4 }); // Aumentado para 12pt e lineGap 4
    doc.y += 4;
    doc.x = 50;
    continue;
  }

  // 9. Acumula linhas de texto comuns
  accumulatedPara.push(line);
}

// Renderiza blocos e parágrafos remanescentes
if (inBlockquote) renderBlockquote();
if (inTable) renderTable();
if (inCodeBlock) renderCodeBlock();
flushParagraph();

// ----------------------------------------------------
// 3. CABEÇALHOS, RODAPÉS E MARCA D'ÁGUA DISCRETA (LOGO)
// ----------------------------------------------------
const range = doc.bufferedPageRange();
for (let i = 1; i < range.count; i++) {
  doc.switchToPage(i);
  
  // Isolar o estado de desenho
  doc.save();
  
  // SOLUÇÃO CRÍTICA DO LOOP DE PÁGINAS EM BRANCO:
  // Temporariamente removemos as margens do documento para zero.
  // Isso impede que as chamadas doc.text() no cabeçalho (y=32) ou rodapé (y=752)
  // passem das margens de wrapping padrão e disparem a criação automática e infinita de novas páginas em PDFKit!
  const oldMargins = doc.page.margins;
  doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
  
  // Cabeçalho da página (Alinhado à esquerda) - Aumentado para 9.5pt para apoio visual
  doc.font('Times-Italic').fontSize(9.5).fillColor('#2c5e5e');
  doc.text('CASA NO CONTROLE — MÉTODO DE ORGANIZAÇÃO DOMÉSTICA', 50, 32, { align: 'left' });
  
  // Desenho do Favicon/Logo discreto no Cabeçalho (Canto superior direito)
  // Dimensão ~1cm x 1cm, cor laranja terracota da marca
  doc.save();
  doc.translate(542, 26);
  doc.scale(0.85);
  doc.path('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6')
     .lineWidth(1)
     .strokeColor('#d97706')
     .stroke();
  doc.restore();

  // Linha superior
  doc.moveTo(50, 44)
     .lineTo(562, 44)
     .strokeColor('#e2e8f0')
     .lineWidth(0.5)
     .stroke();

  // Rodapé da página (Linha inferior)
  doc.moveTo(50, 742)
     .lineTo(562, 742)
     .strokeColor('#e2e8f0')
     .lineWidth(0.5)
     .stroke();

  // Copyright e Paginação (Sem ano para ser Evergreen) - Aumentado para 9.5pt para acessibilidade
  doc.font('Helvetica').fontSize(9.5).fillColor('#71717a');
  doc.text('© Casa no Controle. Guia Prático de 30 Dias.', 50, 752, { align: 'left' });
  doc.text(`Página ${i + 1} de ${range.count}`, 50, 752, { align: 'right', width: 512 });
  
  // Restaura as margens originais e o estado
  doc.page.margins = oldMargins;
  doc.restore();
}

// Finaliza o arquivo PDF
doc.end();

writeStream.on('finish', () => {
  console.log('Sucesso! O arquivo PDF foi gerado e salvo em: ' + pdfPath);
});
