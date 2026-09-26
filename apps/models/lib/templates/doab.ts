// doáb.ai — the first business model, kept as a starting template.
// Source of truth for the numbers: solidarity-lab/business-models, doab/model.js.
// Every number is a placeholder, not a doáb figure.
import type { ModelDefinition } from "../engine";

export const DOAB: ModelDefinition = {
  "id": "doab",
  "name": "doáb.ai",
  "tagline": "Two waters, one fertile ground",
  "description": "A cooperative of doers and builders. Layered memberships, a peer to peer marketplace at member rates, a consulting arm, and grants that feed the coop fund.",
  "currency": "USD",
  "currencySymbol": "$",
  "horizon": 36,
  "breakEvenMonth": 12,
  "unitLabel": "members",
  "canvas": {
    "keyPartners": [
      "Institutional members: hospitals, universities, foundations that sponsor people into the Forge",
      "Venture members that build for other members at member rates",
      "Foundations and governments funding common service lines and the coop fund",
      "Platform providers: Skool, Elements, Slack",
      "A leadership and facilitation arm (Soul) for the learning side of the coop"
    ],
    "keyActivities": [
      "Matchmaking: reading each member's reality and forming cohorts of accompaniment",
      "Facilitating weekly Forge cohorts around a shared problem",
      "Producing content, media and events that open the door",
      "Negotiating and running common service lines (grant management, payroll) for all members",
      "Feeding every learning back into the playbook"
    ],
    "keyResources": [
      "Core facilitation and ops team",
      "The playbook: a fractal, repeatable process for launching a region",
      "The community platform and its record of problems solved",
      "The coop fund, fed by surplus and grants",
      "Trust between members: reciprocity by design"
    ],
    "valuePropositions": [
      {
        "text": "See what is happening: content, media and events from the frontier",
        "segments": [
          "community"
        ]
      },
      {
        "text": "Builders building builders: find your lane, join a cohort on the same problem, meet weekly",
        "segments": [
          "forge"
        ]
      },
      {
        "text": "Solve operational challenges with AI and stay small, using member services at member rates",
        "segments": [
          "venture"
        ]
      },
      {
        "text": "Build capacity in house by sponsoring people through the Forge and opening your ecosystem",
        "segments": [
          "institutional"
        ]
      },
      {
        "text": "Surplus flows back to members in proportion to their contribution; no competition inside",
        "segments": [
          "forge",
          "venture",
          "institutional"
        ]
      }
    ],
    "customerRelationships": [
      "Peer to peer accompaniment in cohorts",
      "Every member gives back: methods shared, sessions others can sit in on",
      "Peer governance, governing in unity",
      "Local meetups and a weekly rhythm"
    ],
    "channels": [
      "Public content, media and events as the top of the funnel",
      "Launch a region with an event, then local meetups",
      "The coop platform and cohort calendar",
      "Member referrals and institutional sponsors"
    ]
  },
  "settings": [
    {
      "id": "perCohort",
      "label": "Members per Forge cohort",
      "unit": "members",
      "value": 8,
      "step": 1
    },
    {
      "id": "procFee",
      "label": "Payment processing fee",
      "unit": "% of revenue",
      "value": 2.5,
      "step": 0.1
    }
  ],
  "genericVariable": [
    {
      "id": "procFee",
      "label": "Payment processing",
      "kind": "percentRevenue"
    }
  ],
  "generators": [
    {
      "id": "community",
      "segment": "Curious individuals: level one, light engagement",
      "name": "Community members",
      "short": "Community",
      "help": "Level one. Light engagement: content, media, events. Free or nearly free, the top of the funnel.",
      "inputs": [
        {
          "id": "fee",
          "label": "Monthly fee",
          "unit": "USD / member",
          "value": 0,
          "step": 5
        },
        {
          "id": "start",
          "label": "Members in month one",
          "unit": "members",
          "value": 150,
          "step": 10
        },
        {
          "id": "growth",
          "label": "Monthly growth",
          "unit": "%",
          "value": 8,
          "step": 0.5
        },
        {
          "id": "churn",
          "label": "Monthly churn",
          "unit": "%",
          "value": 2,
          "step": 0.5
        }
      ],
      "volume": {
        "start": "start",
        "growth": "growth",
        "churn": "churn"
      },
      "revenuePerUnit": "fee",
      "costs": [
        {
          "id": "cOnboard",
          "label": "Onboarding",
          "unit": "USD / new member",
          "kind": "perNewUnit",
          "value": 5,
          "step": 1
        },
        {
          "id": "cCare",
          "label": "Community management",
          "unit": "USD / member / month",
          "kind": "perUnit",
          "value": 1.5,
          "step": 0.5
        }
      ]
    },
    {
      "id": "forge",
      "segment": "Individual builders who want to learn by doing, in cohorts",
      "name": "Forge builders",
      "short": "Forge",
      "help": "Level two. Builders building builders: weekly cohorts around a shared problem. The flywheel and the first proof of income.",
      "inputs": [
        {
          "id": "fee",
          "label": "Monthly fee",
          "unit": "USD / member",
          "value": 45,
          "step": 5
        },
        {
          "id": "start",
          "label": "Members in month one",
          "unit": "members",
          "value": 40,
          "step": 5
        },
        {
          "id": "growth",
          "label": "Monthly growth",
          "unit": "%",
          "value": 12,
          "step": 0.5
        },
        {
          "id": "churn",
          "label": "Monthly churn",
          "unit": "%",
          "value": 3,
          "step": 0.5
        }
      ],
      "volume": {
        "start": "start",
        "growth": "growth",
        "churn": "churn"
      },
      "revenuePerUnit": "fee",
      "costs": [
        {
          "id": "cMatch",
          "label": "Matchmaking and onboarding",
          "unit": "USD / new member",
          "kind": "perNewUnit",
          "value": 25,
          "step": 5
        },
        {
          "id": "cCohort",
          "label": "Cohort facilitation",
          "unit": "USD / cohort / month",
          "kind": "perBatch",
          "batchSize": "perCohort",
          "value": 150,
          "step": 10
        },
        {
          "id": "cCare",
          "label": "Community management",
          "unit": "USD / member / month",
          "kind": "perUnit",
          "value": 3,
          "step": 0.5
        }
      ]
    },
    {
      "id": "venture",
      "segment": "Organisations on the frontier, doing and building with AI",
      "name": "Venture members",
      "short": "Ventures",
      "help": "Organisations on the frontier: doing and building, building for others, or doing with the coop's services. They give back through shared methods.",
      "inputs": [
        {
          "id": "fee",
          "label": "Monthly fee",
          "unit": "USD / member",
          "value": 350,
          "step": 25
        },
        {
          "id": "start",
          "label": "Members in month one",
          "unit": "members",
          "value": 6,
          "step": 1
        },
        {
          "id": "growth",
          "label": "Monthly growth",
          "unit": "%",
          "value": 6,
          "step": 0.5
        },
        {
          "id": "churn",
          "label": "Monthly churn",
          "unit": "%",
          "value": 1,
          "step": 0.5
        }
      ],
      "volume": {
        "start": "start",
        "growth": "growth",
        "churn": "churn"
      },
      "revenuePerUnit": "fee",
      "costs": [
        {
          "id": "cOnboard",
          "label": "Intake and matchmaking",
          "unit": "USD / new member",
          "kind": "perNewUnit",
          "value": 100,
          "step": 10
        },
        {
          "id": "cCare",
          "label": "Account care",
          "unit": "USD / member / month",
          "kind": "perUnit",
          "value": 20,
          "step": 5
        }
      ]
    },
    {
      "id": "institutional",
      "segment": "Hospitals, universities, foundations building capacity",
      "name": "Institutional members",
      "short": "Institutions",
      "help": "Hospitals, universities, foundations. They sponsor individuals into the Forge and open their ecosystem to build in.",
      "inputs": [
        {
          "id": "fee",
          "label": "Monthly fee",
          "unit": "USD / member",
          "value": 1200,
          "step": 100
        },
        {
          "id": "start",
          "label": "Members in month one",
          "unit": "members",
          "value": 2,
          "step": 1
        },
        {
          "id": "growth",
          "label": "Monthly growth",
          "unit": "%",
          "value": 4,
          "step": 0.5
        },
        {
          "id": "churn",
          "label": "Monthly churn",
          "unit": "%",
          "value": 0.5,
          "step": 0.5
        }
      ],
      "volume": {
        "start": "start",
        "growth": "growth",
        "churn": "churn"
      },
      "revenuePerUnit": "fee",
      "costs": [
        {
          "id": "cOnboard",
          "label": "Programme design and intake",
          "unit": "USD / new member",
          "kind": "perNewUnit",
          "value": 250,
          "step": 25
        },
        {
          "id": "cCare",
          "label": "Account care",
          "unit": "USD / member / month",
          "kind": "perUnit",
          "value": 60,
          "step": 5
        }
      ]
    },
    {
      "id": "p2p",
      "name": "Peer to peer marketplace",
      "short": "Peer to peer",
      "help": "Members serve members at an agreed member rate: cost plus a margin, or a discount to market. The coop takes a small share of each exchange.",
      "volume": {
        "linkedTo": "venture",
        "factor": 1
      },
      "inputs": [
        {
          "id": "vol",
          "label": "Peer to peer volume per venture member",
          "unit": "USD / month",
          "value": 800,
          "step": 50
        },
        {
          "id": "take",
          "label": "Cooperative take rate",
          "unit": "%",
          "value": 10,
          "step": 0.5
        }
      ],
      "revenuePerUnit": "vol * take / 100",
      "costs": [
        {
          "id": "cPlatform",
          "label": "Matching, contracting and disputes",
          "unit": "% of take",
          "kind": "percentRevenue",
          "value": 15,
          "step": 1
        }
      ]
    },
    {
      "id": "consulting",
      "name": "Consulting arm",
      "short": "Consulting",
      "help": "Advisory beyond what the membership includes, sold at the member rate. Delivered by members and builders who are paid a share.",
      "volume": {
        "linkedTo": "venture",
        "factor": 1
      },
      "inputs": [
        {
          "id": "hours",
          "label": "Hours sold per venture member",
          "unit": "hours / month",
          "value": 4,
          "step": 0.5
        },
        {
          "id": "rate",
          "label": "Member rate",
          "unit": "USD / hour",
          "value": 120,
          "step": 5
        }
      ],
      "revenuePerUnit": "hours * rate",
      "costs": [
        {
          "id": "cDelivery",
          "label": "Delivery payout to consultants",
          "unit": "% of revenue",
          "kind": "percentRevenue",
          "value": 70,
          "step": 5
        }
      ]
    },
    {
      "id": "grants",
      "name": "Grants and sponsorships",
      "short": "Grants",
      "help": "Foundations, governments and in kind partners funding common service lines and the coop fund. Lumpy in reality, smoothed here as a monthly amount.",
      "countsAsUnit": false,
      "inputs": [
        {
          "id": "amount",
          "label": "Grant income",
          "unit": "USD / month",
          "value": 4000,
          "step": 500
        },
        {
          "id": "from",
          "label": "Starts in month",
          "unit": "month",
          "value": 6,
          "step": 1
        }
      ],
      "volume": {
        "start": 1,
        "startMonth": "from"
      },
      "revenueTotal": "amount",
      "costs": [
        {
          "id": "cAdmin",
          "label": "Grant writing and reporting",
          "unit": "% of revenue",
          "kind": "percentRevenue",
          "value": 10,
          "step": 1
        }
      ]
    }
  ],
  "transitions": [
    { "id": "community_to_forge", "from": "community", "to": "forge", "rate": 3, "move": true, "label": "Community members who join the Forge" }
  ],
  "fixedCosts": [
    {
      "id": "team",
      "label": "Core facilitation and ops team",
      "value": 8000,
      "step": 250
    },
    {
      "id": "platform",
      "label": "Platform and software (Skool, Elements, comms)",
      "value": 300,
      "step": 25
    },
    {
      "id": "legal",
      "label": "Legal, admin and compliance",
      "value": 500,
      "step": 50
    },
    {
      "id": "marketing",
      "label": "Marketing, content and community events",
      "value": 700,
      "step": 50
    }
  ],
  "investment": [
    {
      "id": "formation",
      "label": "Cooperative formation and legal framework",
      "value": 8000,
      "step": 500
    },
    {
      "id": "setup",
      "label": "Platform setup and playbook",
      "value": 15000,
      "step": 500
    },
    {
      "id": "launch",
      "label": "Launch event and first content",
      "value": 5000,
      "step": 500
    }
  ]
};
