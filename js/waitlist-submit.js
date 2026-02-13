/**
 * Waitlist form: submit via fetch to Vercel API, show success/error message
 */
(function () {
  const form = document.getElementById("waitlistForm");
  const messageEl = document.getElementById("waitlistMessage");
  const submitBtn = document.getElementById("waitlistSubmitBtn");
  if (!form || !messageEl) return;

  function showMessage(text, isError) {
    messageEl.textContent = text;
    messageEl.hidden = false;
    messageEl.classList.toggle("is-error", !!isError);
  }

  function hideMessage() {
    messageEl.hidden = true;
    messageEl.classList.remove("is-error");
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideMessage();

    const data = new URLSearchParams(new FormData(form));
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Joining…";
    }

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: data.toString(),
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json.ok) {
        showMessage(json.message || "You're on the list. We'll be in touch.", false);
        form.reset();
        var countryEl = document.getElementById("countrySelect");
        if (countryEl) countryEl.dispatchEvent(new Event("change"));
      } else {
        showMessage(json.error || "Something went wrong. Please try again.", true);
      }
    } catch (err) {
      showMessage("Network error. Please check your connection and try again.", true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Join waitlist";
      }
    }
  });
})();
