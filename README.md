# serverless-child-stack-manager

[![serverless][icon-serverless]][link-serverless]
[![license][icon-lic]][link-lic]
[![build status][icon-ci]][link-ci]
[![npm version][icon-npm]][link-npm]

Removes or deploys one or more related CloudFormation stacks when running 'serverless remove' or 'serverless deploy'.

This can be useful to manage tenant resources in multi-tenant apps, when each tenant has a corresponding stack. Creating the tenant stacks is expected to be done by your application, as part of your tenant subscription process, using a common prefix for CloudFormation stack names. The `serverless-child-stack-manager` plugin then handles upgrade and removal of those tenant stacks as part of your main serverless deployment.

## Installation

```sh
npm install serverless-child-stack-manager --save-dev
```

### Compatibility with Serverless Framework

Version 2.0.3 is compatible with Serverless Framework v3, but it uses the legacy logging interface. Version 3.0.0 and later uses the [new logging interface](https://www.serverless.com/framework/docs/guides/plugins/cli-output).

|serverless-child-stack-manager|Serverless Framework|
|---|---|
|≤ v1.3.0|v1.x|
|v2.x|v2.x, v3.x|
|≥ v3.0.0|v3.x|

## Usage

Add the following to your `serverless.yml`:

```yml
plugins:
  - serverless-child-stack-manager

  custom:
    serverless-child-stack-manager:
      # determines which stacks are handled by the plugin
      childStacksNamePrefix: my-stack-prefix
      # what to do with the stacks on 'serverless remove'
      removalPolicy: remove
      # name of a Lambda function to be invoked on 'serverless deploy' for all the associated stacks
      upgradeFunction: ${self:service.name}-${self:provider.stage}-stackUpdate
```

A complete description of configuration options [here](https://github.com/coyoteecd/serverless-child-stack-manager/blob/master/src/serverless-child-stack-manager-config.ts).

[//]: # (Note: icon sources seem to be random. It's just because shields.io is extremely slow so using alternatives whenever possible)
[icon-serverless]: http://public.serverless.com/badges/v3.svg
[icon-lic]: https://img.shields.io/github/license/coyoteecd/serverless-child-stack-manager
[icon-ci]: https://travis-ci.com/coyoteecd/serverless-child-stack-manager.svg?branch=master
[icon-npm]: https://badge.fury.io/js/serverless-child-stack-manager.svg

[link-serverless]: http://www.serverless.com
[link-lic]: https://github.com/coyoteecd/serverless-child-stack-manager/blob/master/LICENSE
[link-ci]: https://travis-ci.com/coyoteecd/serverless-child-stack-manager
[link-npm]: https://www.npmjs.com/package/serverless-child-stack-manager
