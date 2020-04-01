# serverless-child-stack-manager

[![serverless][icon-serverless]][link-serverless]
[![license][icon-lic]][link-lic]
[![build status][icon-ci]][link-ci]
[![npm version][icon-npm]][link-npm]

Removes or deploys one or more related CloudFormation stacks when running 'serverless remove' or 'serverless deploy'.
This can be useful to manage tenant resources in multi-tenant apps, when each tenant has a corresponding stack.

**NOTE**

This repo contains work in progress, do not use.

[//]: # (Note: icon sources seem to be random. It's just because shields.io is extremely slow so using alternatives whenever possible)
[icon-serverless]: http://public.serverless.com/badges/v3.svg
[icon-lic]: https://img.shields.io/github/license/coyoteecd/serverless-child-stack-manager
[icon-ci]: https://travis-ci.com/coyoteecd/serverless-child-stack-manager.svg?branch=master
[icon-npm]: https://badge.fury.io/js/serverless-child-stack-manager.svg

[link-serverless]: http://www.serverless.com
[link-lic]: https://github.com/coyoteecd/serverless-child-stack-manager/blob/master/LICENSE
[link-ci]: https://travis-ci.com/coyoteecd/serverless-child-stack-manager
[link-npm]: https://www.npmjs.com/package/serverless-child-stack-manager
