// CloudiX Docs JavaScript

document.addEventListener('DOMContentLoaded', () => {
    // Set active nav link based on current page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Copy code blocks on click
    document.querySelectorAll('pre code').forEach(block => {
        block.addEventListener('click', () => {
            navigator.clipboard.writeText(block.textContent).then(() => {
                const tooltip = document.createElement('span');
                tooltip.textContent = 'Копирано!';
                tooltip.style.cssText = 'position:fixed;top:20px;right:20px;background:#22c55e;color:white;padding:8px 16px;border-radius:6px;font-size:14px;z-index:9999;';
                document.body.appendChild(tooltip);
                setTimeout(() => tooltip.remove(), 2000);
            });
        });
        block.style.cursor = 'pointer';
        block.title = 'Кликни за копиране';
    });
});
