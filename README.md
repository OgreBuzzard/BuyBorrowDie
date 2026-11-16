# Buy, Borrow, Die — prototype 0.8

Incremental game about wealth and tax. Design doc lives in the Claude project ("Buy, Borrow, Die" → `claude/design-doc.md`).

## Run

    npm install
    npm run dev      # local dev server
    npm run build    # type-check, then build one self-contained dist/index.html
    npm run sim      # headless checks of the monthly numbers

## Layout

- `src/engine/config.ts` — every tunable number: tax brackets, salaries, market, credit, lifestyle items.
- `src/engine/tax.ts` — federal, California and payroll tax.
- `src/engine/game.ts` — state, clock, monthly and yearly processing, player actions. No DOM.
- `src/ui/render.ts` — fills in the static structure in `index.html`.
- `src/main.ts` — clock loop, save/load (localStorage), event wiring.
- `scripts/sim.ts` — headless month-by-month checks.

## Current build: 0.8, the opening

Net worth starts at -$80,000 of student debt. Food, transport and rent drain it continuously. Each month end:
interest on debt (drifting APY), paycheck, mortgage payment, well-being update. End of month 4: last year's
tax, from real 2026 federal, California and payroll schedules (`src/engine/tax.ts`). End of month 12: a bonus
of 0-50% of salary, then a raise, both shaped by the year's work.

Work has two bars: the regular one (8 taps) and an extra-work bar (40 taps) that appears once the first is
full, costs well-being, and pushes the bonus and raise toward the top of their ranges. Quit grows as mood sinks.

Buy shows three offers from `CATALOG`. Apartment adds Rent (and a Move button); House swaps Rent for a
mortgage chosen in the buy panel: price, down payment (10-25%), and loan type (30-year fixed, 15-year fixed,
interest only). Well-being is a hidden 0-100 number shown only as a face; its tuning is in `WELL` in `config.ts`.

Pop-up messages stop the clock until answered (`Popup` in `game.ts`; `answer()` handles each by id). So far:
year-end bonus, taxes due, the retirement match, health care, and the cofounder offer. The space bar is an
alternate Work button.

The cofounder offer comes once, in the late twenties (`ventureMonth()` in `game.ts`). Taking it halves-ish the
salary, doubles both work bars, and adds an Ownership line that is worth nothing for 18-30 months. The company
then either fails (exit package, next company) or gets its first valuation and grows. Declining is permanent
and shortens the player's life.

Pause is at the bottom. Other test controls are in the browser console: `bbd.speed = 20`, `bbd.reset()`, `bbd.state()`.

`docs/index.html` is a built copy of the game in one file. It can be opened directly or served by GitHub Pages.

The 0.1 prototype (investing, credit line, margin calls, lifestyle purchases, estate statement) is kept in
`archive/v0.1/` for reference and is not part of the build.

`State.generation` and `State.estate` are the heir hooks.
