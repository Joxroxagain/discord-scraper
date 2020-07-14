module.exports = function parseMessage(data) {

    if (data.embeds.length > 0) {
        return data.embeds.map(el => {
            return el.url;
        }).join('\n');
    } else {
        return data.content;
    }

}