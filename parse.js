module.exports = function parseMessage(data) {
  const embed = data.embeds[0];
  const urlRegex =
    /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
  const matches = embed.description.match(urlRegex);
  if (matches) return { productUrl: matches[0], atcURL: matches[1] };
  return false;
};
