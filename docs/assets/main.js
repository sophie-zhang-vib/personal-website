/* Personal Website — shared interactions */

(function () {
  "use strict";

  /* ---------- Mobile nav toggle ---------- */
  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("open");
      navToggle.classList.toggle("active", isOpen);
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    // Close menu when a link is clicked (mobile)
    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
        navToggle.classList.remove("active");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Current year in footer ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* ---------- Contact form (front-end only) ---------- */
  var form = document.getElementById("contactForm");
  var success = document.getElementById("formSuccess");

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var name = form.querySelector("#name");
      var email = form.querySelector("#email");
      var message = form.querySelector("#message");

      // Simple validation
      var valid = true;
      [name, email, message].forEach(function (field) {
        if (!field.value.trim()) {
          valid = false;
          field.style.borderColor = "#C97B5C";
        } else {
          field.style.borderColor = "";
        }
      });

      // Basic email check
      var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (email && !emailRe.test(email.value.trim())) {
        valid = false;
        email.style.borderColor = "#C97B5C";
      }

      if (!valid) return;

      if (success) {
        success.classList.add("show");
      }
      form.reset();

      // Hide success after a while
      setTimeout(function () {
        if (success) success.classList.remove("show");
      }, 5000);
    });
  }

  /* ---------- Resume download button (demo) ---------- */
  var downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", function (e) {
      e.preventDefault();
      var original = downloadBtn.innerHTML;
      downloadBtn.innerHTML = "\u2705 Coming soon!";
      downloadBtn.style.pointerEvents = "none";
      setTimeout(function () {
        downloadBtn.innerHTML = original;
        downloadBtn.style.pointerEvents = "";
      }, 1800);
    });
  }

  /* ---------- Scroll reveal for sections ---------- */
  var revealEls = document.querySelectorAll(".section-head, .like-card, .timeline-item, .project-card, .skill-group, .summary-card, .resume-block > .eyebrow, .resume-block, .contact-form, .contact-aside");

  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.animation = "fadeUp 0.6s ease both";
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    revealEls.forEach(function (el) {
      // Skip elements that already animate on load (have .reveal)
      if (!el.classList.contains("reveal")) {
        el.style.opacity = "0";
        io.observe(el);
      }
    });
  }
})();
