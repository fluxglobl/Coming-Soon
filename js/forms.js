/**
 * Country → State/Province dropdown behavior
 */
(function initCountryRegionSelect() {
  const countryEl = document.getElementById("countrySelect");
  const regionEl = document.getElementById("regionSelect");
  const regionTextEl = document.getElementById("regionText");
  const regionWrap = regionEl?.closest(".selectWrap") || null;
  if (!countryEl || !regionEl || !regionTextEl || !regionWrap) return;

  const US_STATES = [
    { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
    { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
    { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
    { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
    { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
    { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
    { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
    { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
    { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
    { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
    { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
    { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
    { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
    { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
    { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
    { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
    { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" }, { code: "DC", name: "District of Columbia" },
  ];

  const GH_REGIONS = [
    "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern", "Greater Accra",
    "North East", "Northern", "Oti", "Savannah", "Upper East", "Upper West",
    "Volta", "Western", "Western North",
  ];

  function setOptions(label, options, mode) {
    regionEl.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.disabled = true;
    ph.selected = true;
    ph.textContent = label;
    regionEl.appendChild(ph);

    options.forEach((opt) => {
      const o = document.createElement("option");
      if (mode === "abbr") {
        o.value = opt.code;
        o.textContent = opt.code;
        o.dataset.fullName = opt.name;
      } else {
        o.value = opt;
        o.textContent = opt;
      }
      regionEl.appendChild(o);
    });
  }

  function useSelect() {
    regionWrap.classList.remove("is-text");
    regionEl.style.display = "";
    regionEl.disabled = false;
    regionTextEl.style.display = "none";
    regionTextEl.disabled = true;
    regionTextEl.required = false;
    regionTextEl.value = "";
  }

  function useTextInput(placeholder) {
    regionWrap.classList.add("is-text");
    regionEl.style.display = "none";
    regionEl.disabled = true;
    regionEl.required = false;
    regionEl.value = "";
    regionTextEl.style.display = "";
    regionTextEl.disabled = false;
    regionTextEl.required = true;
    regionTextEl.placeholder = placeholder;
  }

  function update() {
    const country = (countryEl.value || "").trim();

    if (country === "United States") {
      useSelect();
      regionEl.required = true;
      setOptions("State", US_STATES, "abbr");
      regionEl.closest(".field")?.setAttribute("title", "State");
    } else if (country === "Ghana") {
      useSelect();
      regionEl.required = true;
      setOptions("Region", GH_REGIONS, "full");
      regionEl.closest(".field")?.setAttribute("title", "Region");
    } else {
      useTextInput("Province");
      regionEl.closest(".field")?.setAttribute("title", "Province");
    }
  }

  countryEl.addEventListener("change", update);
  update();
})();
