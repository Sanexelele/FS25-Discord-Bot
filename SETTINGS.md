# Settings and configuration

These are the settings that can be configured in the `config.json` file. The file is located in the root directory of the project. All
fields marked with `(*)` are required to be checked, or leave empty for default values.

| **- Key -**                                  | **- Description -**                                                       |
|----------------------------------------------|---------------------------------------------------------------------------|
| (*) application.serverPassword               | The password to join the server (or leave empty)                          |
| (*) application.serverStatsUrl               | The feed URL to the server stats (from the web interface from the server) |
| (*) application.serverMapUrl                 | The feed URL to the server map (from the web interface from the server)   |
| application.webInterfaceUsername             | Web interface login (HTTP Basic); required if the feed returns 401        |
| application.webInterfacePassword             | Web interface password; use with webInterfaceUsername                     |
| (*) application.updateIntervalSeconds        | The interval in seconds to update the server stats                        |
| (*) discord.botToken                         | The bot token from the Discord Developer Portal                           |
| (*) discord.channelId                        | Single server: text channel id for the live status (ignored if `servers` is set) |
| discord.servers                              | Multiple servers: array of `{ "guildId", "channelId", "label"? }`. Optional `label` is only for your notes (not sent to Discord). |
| translation.discordEmbed.title               | The title of the Discord embed                                            |
| translation.discordEmbed.descriptionOnline   | The description when the server is online                                 |
| translation.discordEmbed.descriptionOffline  | The description when the server is offline                                |
| translation.discordEmbed.descriptionUnknown  | The description when the server status is unknown                         |
| translation.discordEmbed.titleServerName     | The title of the server name                                              |
| translation.discordEmbed.titleServerPassword | The title of the server password                                          |
| translation.discordEmbed.titleServerTime     | The title of the server time                                              |
| translation.discordEmbed.titlePlayerCount    | The title of the player count                                             |
| translation.discordEmbed.noPlayersOnline     | The message when no players are online                                    |
| translation.discordEmbed.titleServerMap      | The title of the server map                                               |
| translation.discordEmbed.titleServerMods     | The title of the server mods                                              |
| translation.common.monthJanuary              | The month January in the language of the server                           |
| translation.common.monthFebruary             | The month February in the language of the server                          |
| translation.common.monthMarch                | The month March in the language of the server                             |
| translation.common.monthApril                | The month April in the language of the server                             |
| translation.common.monthMay                  | The month May in the language of the server                               |
| translation.common.monthJune                 | The month June in the language of the server                              |
| translation.common.monthJuly                 | The month July in the language of the server                              |
| translation.common.monthAugust               | The month August in the language of the server                            |
| translation.common.monthSeptember            | The month September in the language of the server                         |
| translation.common.monthOctober              | The month October in the language of the server                           |
| translation.common.monthNovember             | The month November in the language of the server                          |
| translation.common.monthDecember             | The month December in the language of the server                          |
