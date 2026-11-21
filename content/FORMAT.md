# Content store format

`content/news-drops.json` and `content/frontier-picks.json` are the whole live-data surface of v0.1. The MCP process reads them at startup and never writes them. A scheduled job can replace the files later. Until that job exists, both files are sample data and say so.

The server validates each file with a strict schema (`src/data/content.ts`). Unknown keys fail the process on boot. That is deliberate: there is no field for a ZIP, a name, an email, an IP, or a free-text personal note, and a job must not invent one.

Do not put personal data in these files. ZIPs arrive only as a request argument to `get_news_drop` and are not retained.

## Shared rules

| Field | Rule |
| --- | --- |
| `format` | Exact literal for that file. |
| `updated` | `YYYY-MM-DD` the job wrote the file. |
| `sample` | `true` while the file is fixture data. `false` only for reviewed editorial content. |
| `label` | `example` when `sample` is `true`. `editorial` when `sample` is `false`. |
| `disclaimer` | Human-readable sentence. Keep it. |
| Strings | Plain text. No HTML. |
| `href` | Optional absolute `https://` URL. Sample rows point at `an-alq.com`. |

`sample: true` must travel with `label: "example"`. `sample: false` must travel with `label: "editorial"`. The loader rejects mismatches.

## `content/news-drops.json`

```json
{
  "format": "an-alq.news-drop.v1",
  "updated": "YYYY-MM-DD",
  "sample": true,
  "label": "example",
  "disclaimer": "One sentence a model can show the user.",
  "drops": [
    {
      "id": "stable-id",
      "slot": "morning",
      "edition": "national",
      "headline": "Short headline",
      "summary": "One paragraph.",
      "items": [
        { "title": "Item", "dek": "One or two sentences.", "tag": "example" }
      ],
      "sample": true,
      "label": "example"
    }
  ]
}
```

- `slot` is `morning`, `midday`, or `afternoon`.
- The file must contain each slot exactly once.
- `edition` is `national` in v0.1. Localization is applied at request time from an optional ZIP and is not stored here.
- `items` has one to eight entries.

A job that runs three times a day overwrites the matching slot's `headline`, `summary`, and `items`, then updates `updated`. It should leave `format` alone.

## `content/frontier-picks.json`

```json
{
  "format": "an-alq.frontier-picks.v1",
  "updated": "YYYY-MM-DD",
  "sample": true,
  "label": "example",
  "disclaimer": "One sentence a model can show the user.",
  "months": [
    {
      "month": "YYYY-MM",
      "sample": true,
      "label": "example",
      "intro": "One paragraph.",
      "picks": [
        {
          "id": "stable-id",
          "title": "Pick title",
          "why": "Why it is on the list.",
          "href": "https://an-alq.com/capabilities",
          "sample": true,
          "label": "example"
        }
      ]
    }
  ]
}
```

- `month` is `YYYY-MM`. Months must be unique.
- Each month has one to twelve picks.
- `get_frontier_picks` returns `found: false` and the list of filed months when the caller asks for a month that is not in the file. It does not invent a pick.

## What the job does not receive

The MCP server does not call the job, does not queue ZIPs, and does not write a request log. The job's only input is whatever editorial source you point it at. Its only output is these two files, committed or mounted where the server can read them.
