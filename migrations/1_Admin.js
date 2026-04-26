var Admin = artifacts.require("./Admin.sol");

module.exports = function (deployer) {
  deployer.deploy(Admin);
};