export default interface IDiscordConfiguration {
    channelId: string; // Is meant for the game status display
    gameUpdateChannelId: string|null; // Is meant for updates like bought fields, but is optional
    botToken: string;
}