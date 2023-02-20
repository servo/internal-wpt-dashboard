/* global google */

google.charts.load('current', { packages: ['corechart', 'line'] })
google.charts.setOnLoadCallback(setupChart)

const fetchData = fetch('scores.json')

function formatDate (date) {
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ]
    const year = date.getFullYear()
    const month = months[date.getMonth()]
    const day = date.getDate()
    return `${month} ${day}, ${year}`
}

function parseDateString (date) {
    const [y, m, d] = date.split('-')
    return new Date(y, m - 1, d)
}

function toolTip ([date, wpt_sha, servo_version], score) {
    const d = parseDateString(date)
    return `
        <b>${formatDate(d)}</b></br>
        Score: <b>${score / 10}</b></br>
        WPT: ${wpt_sha}</br>
        Servo: ${servo_version}
    `
}

function setupChart () {
    const endOfYear = new Date(2023, 11, 31)
    let maxDate = new Date()
    if (maxDate > endOfYear) {
        maxDate = endOfYear
    }

    const options = {
        height: 350,
        fontSize: 16,
        legend: { position: 'none' },
        hAxis: {
            format: 'MMM-YYYY',
            viewWindow: {
                max: maxDate
            }
        },
        vAxis: {
            format: 'percent',
            viewWindow: {
                min: 0,
                max: 1
            }
        },
        explorer: {
            actions: ['dragToZoom', 'rightClickToReset'],
            axis: 'horizontal',
            keepInBounds: true,
            maxZoomIn: 4.0
        },
        tooltip: {
            isHtml: true,
            trigger: 'both'
        }
    }

    const node = document.getElementById('servo-chart')
    const area_dropdown = document.getElementById('selected-area')
    const chart = new google.visualization.LineChart(node)
    let all_scores

    function update_chart () {
        if (!all_scores) throw new Error('scores not loaded')
        const chosen_area = area_dropdown.value
        const area_index = all_scores.area_keys.indexOf(chosen_area)
        const table = new google.visualization.DataTable()
        table.addColumn('date', 'runOn')
        table.addColumn('number', 'Score')
        table.addColumn({ type: 'string', role: 'tooltip', p: { html: true } })
        for (const row of all_scores.scores) {
            const score = row[area_index + 3]
            table.addRow([
                parseDateString(row[0]),
                score / 1000,
                toolTip(row, score)
            ])
        }
        chart.draw(table, options)
    }

    fetchData
        .then(resp => resp.json())
        .then(scores => {
            all_scores = scores
            if (scores.scores.length < 60) {
                options.hAxis.format = 'dd MMM YYYY'
            } else {
                options.hAxis.format = 'MMM YYYY'
            }
            const score_table = document.getElementById('score-table-body')
            for (const [idx, area] of scores.area_keys.entries()) {
                const selector = document.createElement('option')
                selector.value = area
                selector.textContent = scores.focus_areas[area] || 'All'
                area_dropdown.appendChild(selector)

                const recent_score = all_scores.scores[all_scores.scores.length - 1]
                score_table.insertAdjacentHTML(
                    'beforeend',
                    `<tr class="${idx % 2 ? 'odd' : 'even'}">
                        <td>${selector.textContent}</td>
                        <td>${String(recent_score[idx + 3] / 10).padEnd(4, '.0')}%</td>
                    </tr>`
                )
            }
            area_dropdown.onchange = update_chart
            area_dropdown.value = scores.area_keys[0]
            update_chart()
        })
}
