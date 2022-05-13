#!/usr/bin/env node

const axios = require("axios");
const _ = require("lodash");
const Queue = require("better-queue");

const scan = {
  status: {},
};

scan.getUsers = async (projectId) => {
  const { data } = await axios.get(
    "https://api.debank.com/project/portfolios/user_list",
    {
      params: {
        id: projectId,
      },
    }
  );
  const userList = data.data["user_list"];

  return userList.map((user) => user["user_addr"]);
};

scan.getPortfolioMethodsByAddressQueue = new Queue(
  (input, cb) => {
    const fetch = async (projectId, userAddress) => {
      const { data } = await axios.get(
        "https://api.debank.com/portfolio/project_list",
        {
          params: {
            user_addr: userAddress,
          },
        }
      );
      const methods = {};

      _.forEach(data.data, (chain) => {
        if (chain.id !== projectId) return;

        _.forEach(chain["portfolio_list"], (portfolio) => {
          methods[portfolio["name"]] = portfolio;
        });
      });

      return [Object.keys(methods), methods];
    };

    fetch(input.projectId, input.userAddress)
      .then((data) => cb(null, data))
      .catch((err) => cb(err, []));
  },
  {
    concurrent: 10,
    maxRetries: 10,
    retryDelay: 5000,
  }
);

scan.getPortfolioMethodsByAddress = (projectId, userAddress, index) => {
  return new Promise((rel, rej) => {
    scan.getPortfolioMethodsByAddressQueue.push(
      {
        projectId,
        userAddress,
      },
      (err, result) => {
        if (err) {
          rej(err);
        } else {
          scan.status[index] = true;
          console.log(
            Object.keys(scan.status).length,
            "/",
            100,
            result[0],
            userAddress,
            _.map(
              result[1],
              (portfolio) => portfolio["pool_id"] || portfolio["pool"]["id"]
            )
          );

          rel(result[0]);
        }
      }
    );
  });
};

scan.getPortfolioMethods = async (projectId) => {
  const userAddresses = await scan.getUsers(projectId);
  const methods = [];

  scan.status = {};

  _.forEach(
    await Promise.all(
      userAddresses.map((userAddress, index) =>
        scan.getPortfolioMethodsByAddress(projectId, userAddress, index)
      )
    ),
    (list) => {
      methods.push(...list);
    }
  );

  return _.uniq(methods);
};

scan.getPortfolioMethods(process.argv[2]).then(console.log);
