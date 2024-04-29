# Purpose

These functions are used to sync content for BeIn POC demo

## Configuration

Configuration template can be found in `local.settings.template` file in the root of this repository.

## Functions

| Function name                            | Purpose                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `todo`         | todo                       |


## Local testing

-   Use `Azurite` for local testing the Azure function (https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azurite?tabs=visual-studio-code). In VSC run `> Azurite: start` command to start emulator.

-   Install `Azure-cli` (https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows?source=recommendations&tabs=azure-cli) Authenticate cli using the `az login` command.

## Running functions

After starting azurite just hit F5 to run functions. No need to install Azure storage emulator if azurite is running. 

If you get exception such as `Cannot be loaded because running scripts is disabled on this system` use the following answer to fix it - https://stackoverflow.com/a/67420296

