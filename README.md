# servo-internal-wpt-dashboard

A simple wpt.fyi like dashboard to track progress of WPT scores for Servo's focus areas.

## Developing locally

1. Install dependencies: `npm i`
2. Generate site/scores.json (takes a few minutes): `node index.js --recalc`
    * or download it: `curl -o site/scores.json https://wpt.servo.org/scores.json`
3. Start a web server: `npx http-server site`
