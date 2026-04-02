const githubIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.66-.22.66-.49 0-.24-.01-1.04-.01-1.88-2.78.62-3.37-1.2-3.37-1.2-.45-1.2-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.58 2.35 1.13 2.92.86.09-.67.35-1.13.63-1.39-2.22-.26-4.55-1.14-4.55-5.09 0-1.13.39-2.06 1.03-2.79-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.06A9.32 9.32 0 0 1 12 6.84c.85 0 1.71.12 2.51.37 1.91-1.35 2.75-1.06 2.75-1.06.55 1.41.2 2.46.1 2.72.64.73 1.03 1.66 1.03 2.79 0 3.96-2.34 4.83-4.57 5.08.36.32.68.95.68 1.91 0 1.38-.01 2.49-.01 2.83 0 .27.17.59.67.49A10.25 10.25 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z"
    />
  </svg>
`;

const repoIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.66-.22.66-.49 0-.24-.01-1.04-.01-1.88-2.78.62-3.37-1.2-3.37-1.2-.45-1.2-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.58 2.35 1.13 2.92.86.09-.67.35-1.13.63-1.39-2.22-.26-4.55-1.14-4.55-5.09 0-1.13.39-2.06 1.03-2.79-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.06A9.32 9.32 0 0 1 12 6.84c.85 0 1.71.12 2.51.37 1.91-1.35 2.75-1.06 2.75-1.06.55 1.41.2 2.46.1 2.72.64.73 1.03 1.66 1.03 2.79 0 3.96-2.34 4.83-4.57 5.08.36.32.68.95.68 1.91 0 1.38-.01 2.49-.01 2.83 0 .27.17.59.67.49A10.25 10.25 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z"
    />
    <path
      fill="currentColor"
      d="M9 8.75A1.75 1.75 0 1 1 7.25 7 1.75 1.75 0 0 1 9 8.75Zm7.75 0A1.75 1.75 0 1 1 15 7a1.75 1.75 0 0 1 1.75 1.75ZM8.5 16.3c.85.5 2.01.8 3.5.8s2.65-.3 3.5-.8c.24-.14.55-.06.69.18.14.24.06.55-.18.69-1.03.61-2.38.93-4.01.93s-2.98-.32-4.01-.93a.5.5 0 1 1 .51-.87Z"
    />
  </svg>
`;

const footerVariants = {
  app: {
    label: "© 2026 Lukasz Migas",
    navHref: "./privacy.html",
    navLabel: "Privacy",
  },
  privacy: {
    label: "Lukasz Migas - author, made in 2026",
    navHref: "./index.html",
    navLabel: "App",
  },
};

function createIconLink({ href, label, icon }) {
  return `
    <a
      class="icon-button"
      href="${href}"
      target="_blank"
      rel="noreferrer"
      aria-label="${label}"
      title="${label}"
    >
      ${icon}
    </a>
  `;
}

function createFooterMarkup(variant) {
  const config = footerVariants[variant] ?? footerVariants.app;

  return `
    <span>${config.label}</span>
    <div class="site-footer-links">
      <a href="${config.navHref}">${config.navLabel}</a>
      <div class="footer-icon-links" aria-label="GitHub links">
        ${createIconLink({
          href: "https://github.com/lukasz-migas",
          label: "GitHub profile",
          icon: githubIcon,
        })}
        ${createIconLink({
          href: "https://github.com/lukasz-migas/pdf-organizer",
          label: "GitHub repository",
          icon: repoIcon,
        })}
      </div>
    </div>
  `;
}

export function renderFooter() {
  const footer = document.querySelector("[data-site-footer]");

  if (!footer) {
    return;
  }

  const variant = footer.dataset.footerVariant;
  footer.innerHTML = createFooterMarkup(variant);
}
