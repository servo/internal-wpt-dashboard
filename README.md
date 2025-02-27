# servo-internal-wpt-dashboard

A simple wpt.fyi like dashboard to track progress of WPT scores for Servo's focus areas.

This repo is responsible for
 - Running the WPT suite every day and persisting the results in `runs-2020` folder.
 - Recalculating the scores for all runs based on the tests used for the current run.
 - Publishing the new scores as a scores.json file available at https://wpt.servo.org/scores.json

The source for the frontend of the dashboard lives [in the servo.org repository.](https://github.com/servo/servo.org/blob/main/wpt.md)

## Developing locally on the scoring logic

1. Install dependencies: `npm i`
2. Trigger the recalulation of scores using `node index.js --recalc'
3. The updated scores will be written to `./site/scores.json`
