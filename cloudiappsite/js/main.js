/**
 * CloudiX Landing Page - JavaScript
 * Handles navigation, animations, and interactions
 */

// ================================
// DOM Elements
// ================================
const navbar = document.querySelector('.navbar');
const navToggle = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');
const navLinks = document.querySelectorAll('.nav-links a, .mobile-menu a');

// ================================
// Initialize Lucide Icons
// ================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Initial scroll check
    handleScroll();

    // Hide scroll indicator after user scrolls
    const scrollIndicator = document.querySelector('.scroll-indicator');

    if (scrollIndicator) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 100) {
                scrollIndicator.style.opacity = '0';
            } else {
                scrollIndicator.style.opacity = '1';
            }
        }, { passive: true });
    }
});

// ================================
// Navbar Scroll Effect
// ================================
function handleScroll() {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
}

window.addEventListener('scroll', handleScroll);

// ================================
// Mobile Menu Toggle
// ================================
navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    mobileMenu.classList.toggle('active');
});

// Close mobile menu when clicking a link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        mobileMenu.classList.remove('active');
    });
});

// ================================
// Smooth Scroll for Navigation
// ================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));

        if (target) {
            const offsetTop = target.offsetTop - 80; // Account for fixed navbar

            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// ================================
// Intersection Observer for Animations
// ================================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe elements that should animate
document.querySelectorAll('.feature-card, .step-card, .plan-card, .section-header').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// Add animation class
document.head.insertAdjacentHTML('beforeend', `
  <style>
    .animate-in {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
  </style>
`);

// ================================
// Stagger Animation for Grids
// ================================
function animateGridItems(containerSelector, itemSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const items = container.querySelectorAll(itemSelector);

    const containerObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                items.forEach((item, index) => {
                    setTimeout(() => {
                        item.classList.add('animate-in');
                    }, index * 100);
                });
                containerObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });

    containerObserver.observe(container);
}

animateGridItems('.features-grid', '.feature-card');
animateGridItems('.steps-container', '.step-card');
animateGridItems('.plans-grid', '.plan-card');

// ================================
// Parallax Effect for Hero
// ================================
const heroGlows = document.querySelectorAll('.hero-glow');

window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;

    heroGlows.forEach((glow, index) => {
        const speed = (index + 1) * 0.3;
        glow.style.transform = `translate(${scrolled * speed * 0.1}px, ${scrolled * speed * 0.2}px)`;
    });
}, { passive: true });

// ================================
// App Window Hover Effect
// ================================
const appWindow = document.querySelector('.app-window');

if (appWindow) {
    appWindow.addEventListener('mousemove', (e) => {
        const rect = appWindow.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;

        appWindow.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    appWindow.addEventListener('mouseleave', () => {
        appWindow.style.transform = 'rotateY(-5deg) rotateX(5deg)';
    });
}

// ================================
// Countdown Timer (Optional Enhancement)
// ================================
function updateCountdown() {
    const deadline = new Date('December 31, 2025 23:59:59').getTime();
    const now = new Date().getTime();
    const distance = deadline - now;

    if (distance > 0) {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

        const deadlineDate = document.querySelector('.deadline-date');
        if (deadlineDate) {
            // Keep the static text for now, but you could update it dynamically
            // deadlineDate.textContent = `${days}d ${hours}h ${minutes}m remaining`;
        }
    }
}

// Update countdown every minute
updateCountdown();
setInterval(updateCountdown, 60000);

// ================================
// Console Easter Egg
// ================================
console.log('%c☁️ CloudiX App', 'font-size: 24px; font-weight: bold; background: linear-gradient(135deg, #7c3aed, #3b82f6); -webkit-background-clip: text; color: transparent;');
console.log('%cEarn coins. Redeem hosting. Coming soon!', 'font-size: 14px; color: #a78bfa;');
console.log('%cVisit: https://app.cloudixhosting.site', 'font-size: 12px; color: #6a6a7e;');

// ================================
// Performance: Lazy Load Images
// ================================
if ('IntersectionObserver' in window) {
    const lazyImages = document.querySelectorAll('img[data-src]');

    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });

    lazyImages.forEach(img => imageObserver.observe(img));
}
