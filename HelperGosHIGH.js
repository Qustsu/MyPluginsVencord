(function() {
    const { addContextMenuPatch } = Vencord.Api.ContextMenu;
    const { findByPropsLazy } = Vencord.Webpack;
    const { ComponentDispatch, Menu, UserStore, ChannelStore } = Vencord.Webpack.Common;
    
    const ChannelActions = findByPropsLazy("selectChannel");
    
    if (window.VencordRemotePluginAPI) {
        window.VencordRemotePluginAPI.registerPlugin({
            name: "HelperGosHIGH",
            settings: {
                faction: {
                    type: "select",
                    label: "Фракция",
                    default: "FIB",
                    options: [
                        { label: "FIB", value: "FIB" },
                        { label: "LSCSD", value: "LSCSD" },
                        { label: "LSPD", value: "LSPD" },
                        { label: "SANG", value: "SANG" },
                        { label: "EMS", value: "EMS" }
                    ]
                },
                guildId: {
                    type: "string",
                    label: "ID сервера Discord",
                    default: "1317168924273541130"
                },
                auditChannelId: {
                    type: "string",
                    label: "ID канала кадрового аудита",
                    default: "1317168942183350312"
                },
                reportChannelId: {
                    type: "string",
                    label: "ID канала с отчётами на повышение",
                    default: "1317168942183350312"
                },
                commandChannelId: {
                    type: "string",
                    label: "ID канала для команды",
                    default: "1317168933400350748"
                },
                debugMode: {
                    type: "boolean",
                    label: "Дебаг режим",
                    description: "Показывать JSON сообщений в контекстном меню",
                    default: false
                }
            }
        });
    }
    
    function getSetting(key, defaultValue) {
        const value = window.VencordRemotePluginAPI?.getSetting("HelperGosHIGH", key, defaultValue);
        return value !== undefined ? value : defaultValue;
    }
    
    addContextMenuPatch("message", (children, { message, channel }) => {
        const debugMode = getSetting("debugMode", false);
        const auditChannelId = getSetting("auditChannelId", "1317168942183350312");
        const reportChannelId = getSetting("reportChannelId", "1317168942183350312");
        
        // Дебаг режим
        if (debugMode) {
            children.push(
                Vencord.Webpack.Common.React.createElement(Menu.MenuItem, {
                    id: "vc-debug-json",
                    label: "JSON Сообщения",
                    action: () => {
                        console.log("=== MESSAGE JSON ===");
                        console.log(JSON.stringify(message, null, 2));
                        if (message.embeds?.[0]) {
                            console.log("=== EMBED JSON ===");
                            console.log(JSON.stringify(message.embeds[0], null, 2));
                        }
                    }
                })
            );
        }
        
        // Заполнить аудит
        if (message?.embeds?.[0] && channel.id === reportChannelId) {
            const embed = message.embeds[0];
            
            children.push(
                Vencord.Webpack.Common.React.createElement(Menu.MenuItem, {
                    id: "vc-fill-audit",
                    label: "Заполнить аудит",
                    action: () => {
                        try {
                            const fields = embed.fields || [];
                            let rank = "";
                            let userId = "";
                            
                            for (const field of fields) {
                                if (field.rawName?.includes("На какой ранг")) {
                                    rank = field.rawValue;
                                }
                                if (field.rawName?.includes("Discord")) {
                                    const match = field.rawValue.match(/(\d{17,19})/);
                                    if (match) userId = match[1];
                                }
                            }
                            
                            if (!rank || !userId) {
                                console.error("Не удалось найти ранг или ID пользователя");
                                return;
                            }
                            
                            const prevRank = parseInt(rank) - 1;
                            const messageUrl = `https://discord.com/channels/${channel.guild_id || "@me"}/${channel.id}/${message.id}`;
                            const commandChannelId = getSetting("commandChannelId", "1317168933400350748");
                            const command = `/повышение пользователь:<@${userId}> был:${prevRank} стал:${rank} причина:${messageUrl}`;
                            
                            ChannelActions.selectChannel({ channelId: commandChannelId, guildId: channel.guild_id });
                            setTimeout(() => {
                                ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", { plainText: "" });
                                ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", { plainText: command });
                            }, 150);
                        } catch (err) {
                            console.error("Ошибка при обработке:", err);
                        }
                    }
                })
            );
        }
    });
    

    
    // Команда /отчётинст через API команд
    const { registerCommand } = Vencord.Api.Commands;
    const MessageStore = findByPropsLazy("getMessages", "getMessage");
    
    registerCommand({
        name: "отчётинст",
        description: "Найти все отчёты с упоминанием вас",
        execute: async (_, ctx) => {
            const currentUserId = UserStore.getCurrentUser().id;
            const auditChannelId = getSetting("auditChannelId", "1317168942183350312");
            const guildId = getSetting("guildId", "1317168924273541130");
            
            const messages = MessageStore.getMessages(auditChannelId)?._array || [];
            console.log("[отчётинст] Messages:", messages.length);
            
            const links = [];
            for (const msg of messages) {
                if (msg.embeds?.[0]) {
                    const fields = msg.embeds[0].fields || [];
                    for (const field of fields) {
                        const rawValue = field.rawValue || field.value || "";
                        console.log("[отчётинст] Field:", field.rawName, "Value:", rawValue);
                        if (field.rawName?.includes("Повышает") && (rawValue.includes(`<@!${currentUserId}>`) || rawValue.includes(`<@${currentUserId}>`))) {
                            links.push(`https://discord.com/channels/${guildId}/${auditChannelId}/${msg.id}`);
                            console.log("[отчётинст] Match found:", msg.id);
                            break;
                        }
                    }
                }
            }
            
            console.log("[отчётинст] Total links:", links.length);
            
            if (links.length === 0) {
                return { content: "❌ Отчёты не найдены" };
            }
            
            const header = `✅ Найдено отчётов: ${links.length}\n\n`;
            const chunks = [];
            let currentChunk = header;
            
            for (const link of links) {
                const line = link + "\n";
                if ((currentChunk + line).length > 1900) {
                    chunks.push(currentChunk);
                    currentChunk = line;
                } else {
                    currentChunk += line;
                }
            }
            if (currentChunk) chunks.push(currentChunk);
            
            return { content: chunks[0] };
        }
    });
    
    console.log("[HelperGosHIGH] Плагин загружен");
})();
