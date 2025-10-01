(function () {
  const p = [];
  for (let i = 0.01; i < 1; i += 0.01) {
    p.push(i);
  }
  const logit_p = p.map(function (p_val) {
    return Math.log(p_val / (1 - p_val));
  });

  const trace = {
    x: p,
    y: logit_p,
    mode: "lines",
    line: {
      color: "green",
    },
    hoverlabel: {
      bgcolor: "green",
    },
  };

  const data = [trace];

  const p_val_1 = 0.75;
  const logit_p_val_1 = Math.log(p_val_1 / (1 - p_val_1));
  const p_val_2 = 0.9;
  const logit_p_val_2 = Math.log(p_val_2 / (1 - p_val_2));

  const layout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    xaxis: {
      title: { text: "p" },
      tickmode: "linear",
      tick0: 0,
      dtick: 0.25,
    },
    yaxis: {
      title: { text: "logit(p)" },
      range: [-3, 3],
      fixedrange: true,
    },
    dragmode: false,
    scrollZoom: false,
    shapes: [
      {
        type: "line",
        x0: p_val_1,
        y0: 0,
        x1: p_val_1,
        y1: logit_p_val_1,
        line: {
          color: "grey",
          width: 2,
          dash: "dash",
        },
      },
      {
        type: "line",
        x0: 0,
        y0: logit_p_val_1,
        x1: p_val_1,
        y1: logit_p_val_1,
        line: {
          color: "grey",
          width: 2,
          dash: "dash",
        },
      },
      {
        type: "line",
        x0: p_val_2,
        y0: 0,
        x1: p_val_2,
        y1: logit_p_val_2,
        line: {
          color: "grey",
          width: 2,
          dash: "dash",
        },
      },
      {
        type: "line",
        x0: 0,
        y0: logit_p_val_2,
        x1: p_val_2,
        y1: logit_p_val_2,
        line: {
          color: "grey",
          width: 2,
          dash: "dash",
        },
      },
    ],
  };

  Plotly.newPlot("sigmoidDiv", data, layout, { displayModeBar: false });
})();
