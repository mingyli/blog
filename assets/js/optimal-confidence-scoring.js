(function () {
  const p = [0.4, 0.6, 0.75];
  const y = [0, 0, 1];

  function score(c) {
    let totalScore = 0;
    for (let i = 0; i < p.length; i++) {
      const pi = p[i];
      const yi = y[i];

      // scale_c(p) = p^c / (p^c + (1-p)^c)
      const p_c = Math.pow(pi, c) / (Math.pow(pi, c) + Math.pow(1 - pi, c));

      // score(p_c) = y log(p_c) + (1-y)log(1-p_c)
      if (yi === 1) {
        totalScore += Math.log(p_c);
      } else {
        totalScore += Math.log(1 - p_c);
      }
    }
    return totalScore;
  }

  const c_values = [];
  for (let i = -2.0; i <= 5.0; i += 0.02) {
    c_values.push(i);
  }

  const scores = c_values.map((c) => score(c));

  const trace = {
    x: c_values,
    y: scores,
    mode: "lines",
    line: {
      color: "green",
    },
    hoverlabel: {
      bgcolor: "green",
    },
  };

  const layout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    xaxis: {
      title: { text: "c" },
    },
    yaxis: {
      title: { text: "score" },
    },
    dragmode: false,
    scrollZoom: false,
  };

  Plotly.newPlot("confidenceDiv", [trace], layout, {
    displayModeBar: false,
  });
})();
