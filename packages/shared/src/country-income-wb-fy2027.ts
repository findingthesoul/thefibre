// World Bank country income groups, fiscal year 2027 — the data behind
// soul.com's Country Category Policy, and behind any other workspace that
// wants to price by what a country can pay.
//
// SOURCE: World Bank country classifications by income level, FY2027 (based
// on 2025 GNI per capita). datahelpdesk.worldbank.org, article 906519.
// Fetched 2026-10-14.
//
// THE POLICY (soul.com, "Foundational documents" → Country Category Policy):
//   Category A — high income          → 100%, so no rule is written for it.
//   Category B — upper-middle income  →  75%.
//   Category C — lower-middle and low →  50%.
//
// IN THE REPO AS DATA, deliberately. The World Bank republishes these groups
// every July; when they move, this is an edit to a list rather than a hunt
// through a database. The codes are ISO alpha-2 as the shared COUNTRIES list
// spells them, and `wb` keeps the World Bank's own name beside each one so
// the next update can be diffed against their table without a translation
// step.
//
// NINE NAMES DIFFER between the two sources and were mapped by hand, in the
// open, rather than fuzzy-matched: Micronesia (Fed. Sts.)→FM, St. Lucia→LC,
// St. Vincent and the Grenadines→VC, Congo (Rep.)→CG, Congo (Dem. Rep.)→CD,
// Kyrgyz Republic→KG, Lao PDR→LA, West Bank and Gaza→PS, Kosovo→XK. The two
// Congos are the pair a list like this gets wrong; both are checked, and both
// happen to sit in Category C, so even a mix-up would not have moved a price
// — which is exactly the kind of luck not to rely on twice.
//
// CATEGORY A IS NOT LISTED. It is every country that is in neither of these,
// and writing it out would be a second place to forget to update. Chile and
// Curaçao are the ones worth knowing are in it: both are high income, and
// Chile in particular was entered by hand at 75% before this data existed.

export type IncomeCountry = {
  /** ISO alpha-2, as `COUNTRIES` spells it. */
  code: string;
  /** The World Bank's own name, for diffing against their table next July. */
  wb: string;
};

/** Category B — upper-middle income. */
export const WB_FY2027_UPPER_MIDDLE: IncomeCountry[] = [
  { code: 'AL', wb: "Albania" },
  { code: 'AM', wb: "Armenia" },
  { code: 'AR', wb: "Argentina" },
  { code: 'AZ', wb: "Azerbaijan" },
  { code: 'BA', wb: "Bosnia and Herzegovina" },
  { code: 'BR', wb: "Brazil" },
  { code: 'BW', wb: "Botswana" },
  { code: 'BY', wb: "Belarus" },
  { code: 'BZ', wb: "Belize" },
  { code: 'CN', wb: "China" },
  { code: 'CO', wb: "Colombia" },
  { code: 'CU', wb: "Cuba" },
  { code: 'CV', wb: "Cabo Verde" },
  { code: 'DM', wb: "Dominica" },
  { code: 'DO', wb: "Dominican Republic" },
  { code: 'DZ', wb: "Algeria" },
  { code: 'EC', wb: "Ecuador" },
  { code: 'FJ', wb: "Fiji" },
  { code: 'FM', wb: "Micronesia (Fed. Sts.)" },
  { code: 'GA', wb: "Gabon" },
  { code: 'GD', wb: "Grenada" },
  { code: 'GE', wb: "Georgia" },
  { code: 'GQ', wb: "Equatorial Guinea" },
  { code: 'GT', wb: "Guatemala" },
  { code: 'ID', wb: "Indonesia" },
  { code: 'IQ', wb: "Iraq" },
  { code: 'IR', wb: "Iran" },
  { code: 'JM', wb: "Jamaica" },
  { code: 'JO', wb: "Jordan" },
  { code: 'KZ', wb: "Kazakhstan" },
  { code: 'LC', wb: "St. Lucia" },
  { code: 'LK', wb: "Sri Lanka" },
  { code: 'LY', wb: "Libya" },
  { code: 'MD', wb: "Moldova" },
  { code: 'ME', wb: "Montenegro" },
  { code: 'MH', wb: "Marshall Islands" },
  { code: 'MK', wb: "North Macedonia" },
  { code: 'MN', wb: "Mongolia" },
  { code: 'MU', wb: "Mauritius" },
  { code: 'MV', wb: "Maldives" },
  { code: 'MX', wb: "Mexico" },
  { code: 'MY', wb: "Malaysia" },
  { code: 'PE', wb: "Peru" },
  { code: 'PH', wb: "Philippines" },
  { code: 'PY', wb: "Paraguay" },
  { code: 'RS', wb: "Serbia" },
  { code: 'SR', wb: "Suriname" },
  { code: 'SV', wb: "El Salvador" },
  { code: 'TH', wb: "Thailand" },
  { code: 'TM', wb: "Turkmenistan" },
  { code: 'TO', wb: "Tonga" },
  { code: 'TR', wb: "Türkiye" },
  { code: 'TV', wb: "Tuvalu" },
  { code: 'UA', wb: "Ukraine" },
  { code: 'VC', wb: "St. Vincent and the Grenadines" },
  { code: 'VN', wb: "Vietnam" },
  { code: 'WS', wb: "Samoa" },
  { code: 'XK', wb: "Kosovo" },
  { code: 'ZA', wb: "South Africa" },
];

/** Category C — lower-middle income. */
export const WB_FY2027_LOWER_MIDDLE: IncomeCountry[] = [
  { code: 'AO', wb: "Angola" },
  { code: 'BD', wb: "Bangladesh" },
  { code: 'BJ', wb: "Benin" },
  { code: 'BO', wb: "Bolivia" },
  { code: 'BT', wb: "Bhutan" },
  { code: 'CG', wb: "Congo (Rep.)" },
  { code: 'CI', wb: "Côte d'Ivoire" },
  { code: 'CM', wb: "Cameroon" },
  { code: 'DJ', wb: "Djibouti" },
  { code: 'EG', wb: "Egypt" },
  { code: 'GH', wb: "Ghana" },
  { code: 'GN', wb: "Guinea" },
  { code: 'HN', wb: "Honduras" },
  { code: 'HT', wb: "Haiti" },
  { code: 'IN', wb: "India" },
  { code: 'KE', wb: "Kenya" },
  { code: 'KG', wb: "Kyrgyz Republic" },
  { code: 'KH', wb: "Cambodia" },
  { code: 'KI', wb: "Kiribati" },
  { code: 'KM', wb: "Comoros" },
  { code: 'LA', wb: "Lao PDR" },
  { code: 'LB', wb: "Lebanon" },
  { code: 'LS', wb: "Lesotho" },
  { code: 'MA', wb: "Morocco" },
  { code: 'MM', wb: "Myanmar" },
  { code: 'MR', wb: "Mauritania" },
  { code: 'NA', wb: "Namibia" },
  { code: 'NG', wb: "Nigeria" },
  { code: 'NI', wb: "Nicaragua" },
  { code: 'NP', wb: "Nepal" },
  { code: 'PG', wb: "Papua New Guinea" },
  { code: 'PK', wb: "Pakistan" },
  { code: 'PS', wb: "West Bank and Gaza (Palestine)" },
  { code: 'SB', wb: "Solomon Islands" },
  { code: 'SN', wb: "Senegal" },
  { code: 'ST', wb: "São Tomé and Príncipe" },
  { code: 'SZ', wb: "Eswatini" },
  { code: 'TG', wb: "Togo" },
  { code: 'TJ', wb: "Tajikistan" },
  { code: 'TL', wb: "Timor-Leste" },
  { code: 'TN', wb: "Tunisia" },
  { code: 'TZ', wb: "Tanzania" },
  { code: 'UZ', wb: "Uzbekistan" },
  { code: 'VE', wb: "Venezuela" },
  { code: 'VU', wb: "Vanuatu" },
  { code: 'ZM', wb: "Zambia" },
  { code: 'ZW', wb: "Zimbabwe" },
];

/** Category C — low income. */
export const WB_FY2027_LOW: IncomeCountry[] = [
  { code: 'AF', wb: "Afghanistan" },
  { code: 'BF', wb: "Burkina Faso" },
  { code: 'BI', wb: "Burundi" },
  { code: 'CD', wb: "Congo (Dem. Rep.)" },
  { code: 'CF', wb: "Central African Republic" },
  { code: 'ER', wb: "Eritrea" },
  { code: 'ET', wb: "Ethiopia" },
  { code: 'GM', wb: "Gambia" },
  { code: 'GW', wb: "Guinea-Bissau" },
  { code: 'KP', wb: "North Korea" },
  { code: 'LR', wb: "Liberia" },
  { code: 'MG', wb: "Madagascar" },
  { code: 'ML', wb: "Mali" },
  { code: 'MW', wb: "Malawi" },
  { code: 'MZ', wb: "Mozambique" },
  { code: 'NE', wb: "Niger" },
  { code: 'RW', wb: "Rwanda" },
  { code: 'SD', wb: "Sudan" },
  { code: 'SL', wb: "Sierra Leone" },
  { code: 'SO', wb: "Somalia" },
  { code: 'SS', wb: "South Sudan" },
  { code: 'SY', wb: "Syria" },
  { code: 'TD', wb: "Chad" },
  { code: 'UG', wb: "Uganda" },
  { code: 'YE', wb: "Yemen" },
];

/** Category C is the two of them together: the policy prices them the same,
 *  and keeping them apart here keeps the source diffable. */
export const WB_FY2027_CATEGORY_C: IncomeCountry[] = [
  ...WB_FY2027_LOWER_MIDDLE,
  ...WB_FY2027_LOW,
];

/** The policy, as the percentages a pricing rule is built from. */
export const COUNTRY_CATEGORY_PCT = { B: 75, C: 50, default: 100 } as const;
