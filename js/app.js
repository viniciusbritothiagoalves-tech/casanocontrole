document.addEventListener('DOMContentLoaded', () => {
  // 1. ANIMAÇÕES DE SCROLL (INTERSECTION OBSERVER)
  const animatedElements = document.querySelectorAll('.fade-up-init');
  
  if ('IntersectionObserver' in window) {
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-up-active');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    animatedElements.forEach(el => observer.observe(el));
  } else {
    // Fallback para navegadores muito antigos
    animatedElements.forEach(el => el.classList.add('fade-up-active'));
  }

  // 2. ACCORDION DO FAQ
  const faqTriggers = document.querySelectorAll('.faq-trigger');

  faqTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const contentId = trigger.getAttribute('aria-controls');
      const content = document.getElementById(contentId);
      const isExpanded = trigger.getAttribute('aria-expanded') === 'true';

      // Fechar outros accordions abertos
      faqTriggers.forEach(otherTrigger => {
        if (otherTrigger !== trigger && otherTrigger.getAttribute('aria-expanded') === 'true') {
          otherTrigger.setAttribute('aria-expanded', 'false');
          const otherContent = document.getElementById(otherTrigger.getAttribute('aria-controls'));
          otherContent.style.maxHeight = '0';
          otherContent.style.paddingTop = '0';
          otherContent.style.paddingBottom = '0';
        }
      });

      // Alternar estado do atual
      if (isExpanded) {
        trigger.setAttribute('aria-expanded', 'false');
        content.style.maxHeight = '0';
        content.style.paddingTop = '0';
        content.style.paddingBottom = '0';
      } else {
        trigger.setAttribute('aria-expanded', 'true');
        content.style.paddingTop = '1rem';
        content.style.paddingBottom = '1.5rem';
        content.style.maxHeight = (content.scrollHeight + 40) + 'px'; // Altura dinâmica com margem
      }
    });
  });

  // 3. STICKY CTA NO MOBILE
  const stickyCta = document.querySelector('.sticky-cta-mobile');
  const heroSection = document.querySelector('#hero');
  const footerSection = document.querySelector('footer');

  if (stickyCta && heroSection) {
    const handleScroll = () => {
      const heroBottom = heroSection.getBoundingClientRect().bottom + window.scrollY;
      const currentScroll = window.scrollY;
      
      // Mostrar sticky CTA se rolar depois do Hero
      let shouldShow = currentScroll > heroBottom - 200;

      // Ocultar se estiver no footer para não cobrir informações legais
      if (footerSection) {
        const footerTop = footerSection.getBoundingClientRect().top + window.scrollY;
        const viewportHeight = window.innerHeight;
        if (currentScroll + viewportHeight > footerTop + 50) {
          shouldShow = false;
        }
      }

      if (shouldShow) {
        stickyCta.classList.add('show');
      } else {
        stickyCta.classList.remove('show');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Executa uma vez no início caso o usuário recarregue a página já rolada
    handleScroll();
  }

  // 4. ANIMAR AS FASES DO MÉTODO
  const phases = document.querySelectorAll('.phase-card');
  const stepDots = document.querySelectorAll('.step-dot');

  if (phases.length > 0 && stepDots.length > 0 && 'IntersectionObserver' in window) {
    const phaseObserverOptions = {
      root: null,
      rootMargin: '-20% 0px -40% 0px',
      threshold: 0.2
    };

    const phaseObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.getAttribute('data-phase-index'), 10);
          
          // Desativar todas as bolinhas
          stepDots.forEach(dot => dot.classList.remove('active'));
          
          // Ativar a bolinha correspondente
          if (stepDots[index]) {
            stepDots[index].classList.add('active');
          }
        }
      });
    }, phaseObserverOptions);

    phases.forEach(phase => phaseObserver.observe(phase));
  }

  // 5. INTERAÇÃO DA PRÉVIA DE VÍDEO (REQUISITO OPCIONAL)
  const videoPlayBtn = document.getElementById('play-video-btn');
  const videoOverlay = document.getElementById('video-overlay');
  const videoPlaceholder = document.getElementById('video-placeholder-container');

  if (videoPlayBtn && videoOverlay && videoPlaceholder) {
    videoPlayBtn.addEventListener('click', () => {
      // Oculta overlay com fade
      videoOverlay.style.opacity = '0';
      setTimeout(() => {
        videoOverlay.style.display = 'none';
        
        // Insere o reprodutor real. Substituir pelo link do Youtube/Vimeo real.
        // Aqui colocamos um player mockup HTML5 local ou iframe seguro de demonstração que converte bem
        videoPlaceholder.innerHTML = `
          <video class="w-full h-full object-cover" controls autoplay>
            <source src="https://assets.mixkit.co/videos/preview/mixkit-woman-counting-money-at-home-40017-large.mp4" type="video/mp4">
            Seu navegador não suporta reprodução de vídeo.
          </video>
        `;
      }, 300);
    });
  }
});
