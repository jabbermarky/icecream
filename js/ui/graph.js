/**
 * Graph Rendering Module
 * Canvas-based freezing curve visualization
 */

import { CalcFDP } from '../freezing-curve.js';

/**
 * Draw the freezing curve graph on the canvas
 * Shows the relationship between water frozen percentage and temperature
 *
 * @param {number} Water - Total water content in grams
 * @param {number} PAC - Potere Anti Congelante (freezing point depression power)
 * @param {number} MSNF - Milk Solids Non-Fat content
 * @param {object} Recipe - Recipe object with ServingTemperature and Hardness properties
 * @param {function} getCSS - Function to get CSS property values from elements
 */
export function DrawFreezingGraph(Water, PAC, MSNF, Recipe, getCSS) {
    const temperatureForTgtHardness = -CalcFDP(Water * (1.0 - Recipe.Hardness), PAC, MSNF);
    const step = Water / 20.0;
    var points = [];
    for (var i = 0; i < 20; i++) {
        points.push({ x: i / 20.0, y: -CalcFDP(Water, PAC, MSNF) });
        Water -= step;
    }

    // draw marks at serving temperature and current 75% frozen temperature
    const offX = 32;
    const offY = 36;
    const tempRange = 40.0;

    var canvas = document.getElementById('cvFreezingGraph');
    canvas.width = 600;
    canvas.height = 400;
    if (!DrawFreezingGraph.NotesInitialized) // set only on first execution
    {
        DrawFreezingGraph.NotesInitialized = true;
        // adjust recipe notes width and margin to fit canvas size so that resizing the canvas also resizes the notes area and keeps it aligned
        document.getElementById('taRecipeNotes').style = "width: " + (canvas.width - 2 * offX) + "px; margin-top: " + (offY - 1) + "px;";
    }

    var ctx = canvas.getContext('2d');
    ctx.font = getCSS(canvas, 'font-size') + " " + getCSS(canvas, 'font-family');

    const scaleX = (canvas.width - 2.0 * offX);
    const scaleY = (canvas.height - 2.0 * offY);
    function tx(x) { return x * scaleX + offX; }
    function ty(y) { return y * scaleY + offY; }
    function line(x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(tx(x1), ty(y1));
        ctx.lineTo(tx(x2), ty(y2));
        ctx.stroke();
    }

    // draw axes
    line(0, 0, 0, 1); // Y
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("\u00B0C", tx(0), ty(0) - 4);
    ctx.textAlign = "end";
    ctx.textBaseline = "middle";
    for (var i = 0.0; i <= tempRange; i += 5.0) {
        const y = i / tempRange;
        line(0, y, 0.01, y);
        // if( !(i%10))
        {
            ctx.strokeStyle = '#ccc';
            line(0.01, y, 1.0, y);
            ctx.strokeStyle = '#000';
        }
        ctx.fillText("-" + i + " ", offX - 4, ty(y));
    }
    line(0, 1, 1, 1); // X
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (var i = 0; i <= 100; i += 5) {
        const x = i / 100.0;
        if (!(i % 10)) {
            line(x, 1.0, x, 1.0 - 0.02);
            ctx.fillText(i, tx(x), ty(1) + 4);
        }
        else
            line(x, 1.0, x, 1.0 - 0.01);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("% Water frozen", tx(1) + offX, ty(1) + offY);

    // draw serving temperature and hardness lines
    const servingTemp = -Recipe.ServingTemperature / tempRange;
    const hardnessPoint = temperatureForTgtHardness / tempRange;
    //console.log('hardnessPoint:', hardnessPoint);
    ctx.strokeStyle =
        ctx.fillStyle = getCSS(canvas, '--contrast');
    line(0, servingTemp, 1, servingTemp);
    ctx.textBaseline = hardnessPoint < servingTemp ? "top" : "bottom";
    ctx.fillText("Serving Temperature", tx(1), ty(servingTemp) + (hardnessPoint < servingTemp ? 4 : -4));

    ctx.strokeStyle =
        ctx.fillStyle = getCSS(canvas, '--accent');
    line(0, hardnessPoint, 1, hardnessPoint);
    // vertical line at hardness percentage on X-axis
    line(Recipe.Hardness, 0, Recipe.Hardness, 1);
    ctx.textBaseline = hardnessPoint > servingTemp ? "top" : "bottom";
    ctx.fillText("Hardness " + Math.round(Recipe.Hardness * 100) + "%", tx(1), ty(hardnessPoint) + (hardnessPoint > servingTemp ? 4 : -4));


    // draw curve
    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--accent2');
    ctx.beginPath();
    ctx.moveTo(tx(points[0].x), ty(points[0].y / tempRange));
    for (var i = 1; i < points.length; ++i) {
        //console.log(tx(points[i].x) + " / " + ty(points[i].y));
        ctx.lineTo(tx(points[i].x), ty(points[i].y / tempRange));
    }
    ctx.stroke();
}
