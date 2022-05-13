const axios = require("axios");
const _ = require("lodash");
const fs = require("fs");
const path = require("path");

const PROJECT_ID = "bsc_bxh";
const ADDRESS = "0x56146b129017940d06d8e235c02285a3d05d6b7c";

function buildTable(headers, rows) {
  return `
<style>
table, th, td {
  border: 1px solid black;
  border-collapse: collapse;
}

td, th {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}
</style>
<table border="1" cellspacing="2">
  <thead>
  ${_.map(headers, (header) => {
    let label = header;
    let style = "";

    if (Array.isArray(header)) {
      label = header[0];
      style = `width:${header[1]}px`;
    }

    return `<th style="${style}">${label}</th>`;
  }).join("\n")}
  </thead>
  <tbody>
  ${_.map(
    rows,
    (row) => `<tr>${_.map(row, (v) => `<td>${v}</td>`).join("")}</tr>`
  ).join("\n")}
  </tbody>  
</table>
  `;
}

function formatMoney(number, decPlaces, decSep, thouSep) {
  (decPlaces = isNaN((decPlaces = Math.abs(decPlaces))) ? 2 : decPlaces),
    (decSep = typeof decSep === "undefined" ? "." : decSep);
  thouSep = typeof thouSep === "undefined" ? "," : thouSep;
  var sign = number < 0 ? "-" : "";
  var i = String(
    parseInt((number = Math.abs(Number(number) || 0).toFixed(decPlaces)))
  );
  var j = (j = i.length) > 3 ? j % 3 : 0;

  return (
    sign +
    (j ? i.substr(0, j) + thouSep : "") +
    i.substr(j).replace(/(\decSep{3})(?=\decSep)/g, "$1" + thouSep) +
    (decPlaces
      ? decSep +
        Math.abs(number - i)
          .toFixed(decPlaces)
          .slice(2)
      : "")
  );
}

axios
  .get("https://api.debank.com/portfolio/project_list", {
    params: {
      user_addr: ADDRESS,
    },
  })
  .then(({ data }) => {
    const html = [];

    _.forEach(data.data, (chain) => {
      console.log("PROJECT_ID:", chain.id);
      if (chain.id !== PROJECT_ID) return;

      html.push(
        `<h1>Token: ${chain["name"]} <a href="https://bscscan.com/address/${chain["platform_token_id"]}" target="_blank">${chain["platform_token_id"]}</a></h1>`
      );

      const portfolioList = chain["portfolio_list"];
      const portfolioMap = {};

      _.forEach(portfolioList, (portfolio) => {
        if (!portfolioMap[portfolio["name"]]) {
          portfolioMap[portfolio["name"]] = [];
        }

        portfolioMap[portfolio["name"]].push(portfolio);
      });

      _.forEach(portfolioMap, (portfolios, key) => {
        html.push(`<h3>${key}</h3>`);

        const rows = [];

        _.forEach(portfolios, (portfolio) => {
          const symbols = [];
          const balances = [];
          const rewards = [];

          _.forEach(portfolio["detail"]["supply_token_list"], (token) => {
            symbols.push(token.symbol);
            balances.push(
              `${formatMoney(token["amount"].toFixed(3))} ${token.symbol}`
            );
          });

          _.forEach(portfolio["detail"]["reward_token_list"], (token) => {
            rewards.push(
              `${formatMoney(token["amount"].toFixed(3))} ${token.symbol}`
            );
          });

          const poolAddress = portfolio["pool_id"] || portfolio["pool"]["id"];

          rows.push([
            symbols.join("/"),
            balances.join("<br/>"),
            rewards.join("<br/>"),
            `<a href="https://bscscan.com/address/${poolAddress}" target="_blank">${poolAddress}</a>`,
            portfolio["detail_types"].join("<br/>"),
          ]);
        });

        html.push(
          buildTable(
            [
              ["Pool", 140],
              ["Balance", 140],
              ["Rewards", 140],
              ["Pool Address", 350],
              ["Type", 140],
            ],
            rows
          )
        );
      });
    });

    fs.writeFileSync(path.join(__dirname, "index.html"), html.join(""));
  });
