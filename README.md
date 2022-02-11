# Getting Started with Contract Deployer Plugin
## How to start the project

In the project directory
1. To install dependencies run `yarn`.

2. To start the app in the development mode run `yarn start`.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.



## How to connect to Remix

After you start the development server, go to http://remix.ethereum.org/, navigate to plugin section.

1. Click 'Connect to a Local Plugin'.
2. Provide a plugin name and a display name.
3. in the URL field add 'http://localhost:3000'.
4. Click OK

Now you will see the new plugin in the left bar.

## Documentation

Welcome to the remix-contract-deployer-plugin!

This plugin will help you to work with compiled solidity contracts. This plugin is under a development so most features are under construction.

The plugin aims to deploy multiple contracts to multiple networks with same deterministic address.

1. Open the plugin (you will see compile button).
2. Select compiled solidity contract.
3. Hit load.
4. After loading you will be prompted to enter a hash salt, then if you contract has constructor arguments, you should enter them too. 
5. Choose the network from the list which is powered by Metamask.
6. Deploy and sign the transaction.

To run plugins locally, please refer to [official Remix IDE documentation.](https://remix-ide.readthedocs.io/en/latest/plugin_manager.html?highlight=connect%20to%20local%20plugin#plugin-devs-load-a-local-plugin)


#### About Metamask

Currently plugin uses Metamask as an injected provider, the Remix IDE itself is also "providing" provider whether it's a injected or manually connected. But this plugin does not yet rely on Remix IDEs provider. So for now we are limited to the networks supported or added from metamask. This part is heavily under R&D to find best approaches. 
