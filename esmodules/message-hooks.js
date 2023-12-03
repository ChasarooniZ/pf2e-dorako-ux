import { i18n } from "./util.js";
import { Avatar, ActorAvatar, TokenAvatar, CombatantAvatar } from "./consts.js";

const rgb2hex = (rgb) =>
  `#${rgb
    .match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
    .slice(1)
    .map((n) => parseInt(n, 10).toString(16).padStart(2, "0"))
    .join("")}`;

// second return value is whether the first value can be styled as pf2e-icon
function getActionGlyph(actionCost) {
  if (actionCost === "1 to 3") return ["1 / 2 / 3", true];
  if (actionCost === "1 or 2") return ["1 / 2", true];
  if (actionCost === "2 or 3") return ["2 / 3", true];
  if (actionCost.type === "action") {
    return [actionCost.value, true];
  } else if (actionCost.type === "reaction") return ["R", true];
  else if (actionCost.type === "free") return ["F", true];
  else if (actionCost.length === 1) return [actionCost, true];
  else return [actionCost, false];
}
// Chat cards
Hooks.on("renderChatMessage", (chatMessage, html, messageData) => {
  const isNarratorToolsMessage = chatMessage.flags["narrator-tools"];
  const isMLDRoundMarker = chatMessage.flags["monks-little-details"]?.roundmarker;
  const isMCDRoundMarker = chatMessage.flags["monks-combat-details"]?.roundmarker;
  const isRoundMarker = isMLDRoundMarker || isMCDRoundMarker;
  if (isNarratorToolsMessage || isRoundMarker) {
    return;
  }

  if (game.settings.get("pf2e-dorako-ux", "moving.restructure-card-info")) {
    let uuid = chatMessage?.flags?.pf2e?.origin?.uuid;
    if (uuid) {
      try {
        let origin = fromUuidSync(uuid);
        let actionCost = origin?.actionCost;
        if (actionCost) injectActionCost(html, actionCost);
        if (origin?.type === "spell") injectSpellInfo(html, origin);
      } catch (error) {
        // An error is thrown if the UUID is a reference to something that is not loaded, like an actor in a compendium.
      }
    }
  }

  injectSenderWrapper(html, messageData);
  injectMessageTag(html, messageData);
  injectWhisperParticipants(html, messageData);
  injectAuthorName(html, messageData);

  if (
    (game.settings.get("pf2e-dorako-ux", "avatar.hide-when-token-hidden") &&
      chatMessage.getFlag("pf2e-dorako-ux", "wasTokenHidden")) ||
    (game.settings.get("pf2e-dorako-ux", "avatar.hide-gm-avatar-when-secret") && !chatMessage.isContentVisible)
  ) {
  } else {
    injectAvatar(html, getAvatar(chatMessage));
  }
  moveFlavorTextToContents(html);
});

// Is damage roll
Hooks.on("renderChatMessage", (chatMessage, html, messageData) => {
  if (!game.settings.get("pf2e-dorako-ux", "hiding.remove-attack-info-from-damage-roll-messages")) return;

  if (chatMessage?.isDamageRoll && chatMessage?.item?.type !== "spell") {
    html[0].classList.add("dorako-damage-roll");
    let flavor = html.find(".flavor-text");
    flavor.each(function () {
      $(this).contents().eq(1).wrap("<span/>");
    });
  }
});

// Is check roll
Hooks.on("renderChatMessage", (chatMessage, html, messageData) => {
  if (!game.settings.get("pf2e-dorako-ux", "hiding.remove-attack-info-from-damage-roll-messages")) return;

  if (chatMessage?.isCheckRoll) {
    html.addClass("dorako-check-roll");
  }
});

// "Be last" magic trick. Should ensure that any other modules that modify, say, who spoke the message, have done so before you add the flags.
Hooks.once("ready", () => {
  Hooks.on("preCreateChatMessage", (message) => {
    addAvatarsToFlags(message);
    message.updateSource({
      "flags.pf2e-dorako-ux.wasTokenHidden": message?.token?.hidden,
    });
  });
  Hooks.on("updateChatMessage", (message) => {
    addAvatarsToFlags(message);
  });

  Hooks.on("renderChatMessage", (app, html, data) => {
    const isKoboldWorksTurnAnnouncerMessage = app.flags["koboldworks-turn-announcer"];
    if (!isKoboldWorksTurnAnnouncerMessage) return;

    const avatar = html.find(".portrait");
    avatar.css("transform", `scale(${app.flags["pf2e-dorako-ux"]?.tokenAvatar.scale})`);
    avatar.css("flex", `0px 0px var(--avatar-size)`);
    avatar.css("height", `var(--avatar-size)`);
    avatar.css("width", `var(--avatar-size)`);
  });
});

function moveFlavorTextToContents(html) {
  let flavor = html.find(".flavor-text")[0];
  let contents = html.find(".message-content")[0];
  if (flavor) contents.prepend(flavor);
}

function injectSenderWrapper(html, messageData) {
  if (messageData.author === undefined) return;
  var target = html.find(".message-sender")[0];
  var wrapper = document.createElement("div");
  wrapper.classList.add("sender-wrapper");
  target.parentNode.insertBefore(wrapper, target);
  wrapper.appendChild(target);
}

function injectAvatar(html, avatar) {
  if (!avatar) return;
  let messageHeader = html.find(".message-header")[0];
  let portraitAndName = document.createElement("div");
  portraitAndName.classList.add("portrait-and-name");
  messageHeader.prepend(portraitAndName);
  let wrapper = document.createElement("div");
  wrapper.classList.add("portrait-wrapper");
  let portrait = document.createElement("img");
  portrait.classList.add("avatar");
  portrait.classList.add("portrait");
  wrapper.append(portrait);
  let senderWrapper = html.find(".sender-wrapper")[0];
  portraitAndName.append(senderWrapper);
  portraitAndName.prepend(wrapper);
}

function injectActionCost(html, actionCost) {
  if (!actionCost) return;
  const [actionGlyph, shouldBeStyled] = getActionGlyph(actionCost);
  if (!actionGlyph) return;

  // console.log("Injecting actionGlyph %s", actionGlyph);
  let messageHeader = html.find(".card-header")[0];
  let actionGlyphText = document.createElement("h3");
  html.find(".action-glyph")?.get(0).remove(); // Remove action-glyph added by system
  if (shouldBeStyled) actionGlyphText.classList.add("pf2-icon");
  actionGlyphText.textContent = actionGlyph;
  messageHeader.append(actionGlyphText);
}

function localizeComponent(componentKey) {
  if (componentKey === "focus") return i18n("PF2E.SpellComponentF");
  if (componentKey === "material") return i18n("PF2E.SpellComponentM");
  if (componentKey === "somatic") return i18n("PF2E.SpellComponentS");
  if (componentKey === "verbal") return i18n("PF2E.SpellComponentV");
}

function spellComponentsToText(components) {
  // console.log(components);
  const asArray = Object.entries(components);
  // console.log(asArray);
  const filtered = asArray.filter(([key, value]) => value);
  // console.log(filtered);
  const localized = filtered.map(([key, value]) => localizeComponent(key));
  // console.log(localized);
  const combined = localized.join(", ");
  return " " + combined.toLowerCase();
}

function injectSpellInfo(html, spell) {
  if (!spell) return;
  let messageHeader = html.find(".card-content")[0];
  let spellInfo = document.createElement("div");
  spellInfo.classList.add("spell-info");
  // console.log(spell);

  // Cast time + components
  let time = spell?.system?.time?.value;
  let components = spell?.system?.components;
  let elem = document.createElement("p");
  let castInfoLabel = document.createElement("strong");
  castInfoLabel.textContent = i18n("PF2E.CastLabel") + " ";
  let castTime = document.createElement("span");
  const [actionCost, shouldBeGlyph] = getActionGlyph(time);
  castTime.textContent = actionCost;
  if (shouldBeGlyph) castTime.classList.add("pf2-icon");
  let castComponents = document.createElement("span");
  // castComponents.textContent = spellComponentsToText(components);
  elem.append(castInfoLabel);
  elem.append(castTime);
  // elem.append(castComponents);
  spellInfo.append(elem);

  // Cost info (note: not cast time, material cost)
  let cost = spell?.system?.cost?.value;
  if (cost) {
    let elem = document.createElement("p");
    let label = document.createElement("strong");
    label.textContent = i18n("PF2E.SpellCostLabel") + " ";
    let value = document.createElement("span");
    value.textContent = cost;
    elem.append(label);
    elem.append(value);
    spellInfo.append(elem);
  }

  let secondarycasters = spell?.system?.secondarycasters?.value;
  if (secondarycasters) {
    let info = document.createElement("p");
    let label = document.createElement("strong");
    label.textContent = i18n("PF2E.SpellSecondaryCasters") + " ";
    let value = document.createElement("span");
    value.textContent = secondarycasters;
    info.append(label);
    info.append(value);
    spellInfo.append(info);
  }

  let primarycheck = spell?.system?.primarycheck?.value;
  if (primarycheck) {
    let info = document.createElement("p");
    let label = document.createElement("strong");
    label.textContent = i18n("PF2E.SpellPrimaryCheckLabel") + " ";
    let value = document.createElement("span");
    value.textContent = primarycheck;
    info.append(label);
    info.append(value);
    spellInfo.append(info);
  }

  let secondarycheck = spell?.system?.secondarycheck?.value;
  if (secondarycheck) {
    let info = document.createElement("p");
    let label = document.createElement("strong");
    label.textContent = i18n("PF2E.SpellSecondaryChecksLabel") + " ";
    let value = document.createElement("span");
    value.textContent = secondarycheck;
    info.append(label);
    info.append(value);
    spellInfo.append(info);
  }

  // Target info
  let target = spell?.system?.target?.value;
  if (target) {
    // console.log(target);
    let targetInfo = document.createElement("p");
    let targetInfoLabel = document.createElement("strong");
    targetInfoLabel.textContent = i18n("PF2E.SpellTargetLabel") + " ";
    let targetValue = document.createElement("span");
    targetValue.textContent = target;
    targetInfo.append(targetInfoLabel);
    targetInfo.append(targetValue);
    spellInfo.append(targetInfo);
  }

  // Range info
  let range = spell?.system?.range?.value;
  if (range) {
    // console.log(range);
    let rangeInfo = document.createElement("p");
    let rangeInfoLabel = document.createElement("strong");
    rangeInfoLabel.textContent = i18n("PF2E.SpellRangeLabel") + " ";
    let rangeValue = document.createElement("span");
    rangeValue.textContent = range;
    rangeInfo.append(rangeInfoLabel);
    rangeInfo.append(rangeValue);
    spellInfo.append(rangeInfo);
  }

  // Area info
  let area = spell?.system?.area?.value;
  if (area) {
    // console.log(area);
    let areaInfo = document.createElement("p");
    let areaInfoLabel = document.createElement("strong");
    areaInfoLabel.textContent = i18n("PF2E.AreaLabel") + " ";
    let areaType = spell?.system?.area?.type;
    let areaTypeLabel = areaType
      ? i18n("PF2E.AreaType" + areaType.charAt(0).toUpperCase() + areaType.slice(1)).toLowerCase()
      : "";
    let areaValue = document.createElement("span");
    areaValue.textContent = area + " " + i18n("PF2E.Foot").toLowerCase() + " " + areaTypeLabel;
    areaInfo.append(areaInfoLabel);
    areaInfo.append(areaValue);
    spellInfo.append(areaInfo);
  }

  // Duration info
  let duration = spell?.system?.duration?.value;
  if (duration) {
    // console.log(duration);
    let durationInfo = document.createElement("p");
    let durationInfoLabel = document.createElement("strong");
    durationInfoLabel.textContent = i18n("PF2E.SpellDurationLabel") + " ";
    let durationValue = document.createElement("span");
    durationValue.textContent = duration;
    durationInfo.append(durationInfoLabel);
    durationInfo.append(durationValue);
    spellInfo.append(durationInfo);
  }

  let hr = document.createElement("hr");

  // Heightening info
  let spellRightInfo = html.find(".card-header").find("h4")[0];
  let originalText = spellRightInfo.textContent;
  const [_, spellType, parsedLevel] = originalText.split(/(.*) (\d+)/);

  const baseLevel = spell?.baseLevel;
  const actualLevel = spell?.level;
  if (baseLevel != parsedLevel) {
    let heighteningInfo = document.createElement("h4");
    let spellTypeSpan = document.createElement("span");
    spellTypeSpan.textContent = spellType + " ";

    let originalLevel = document.createElement("s");
    originalLevel.textContent = baseLevel;

    let heightenedLevel = document.createElement("span");
    heightenedLevel.classList.add("heightened");
    heightenedLevel.textContent = " " + parsedLevel;

    heighteningInfo.append(spellTypeSpan);
    heighteningInfo.append(originalLevel);
    heighteningInfo.append(heightenedLevel);

    spellRightInfo.parentNode.replaceChild(heighteningInfo, spellRightInfo);
  }

  // Footer
  let footer = html.find(".card-footer")[0];
  if (footer) footer.classList.add("dorako-display-none");

  messageHeader.prepend(hr);
  messageHeader.prepend(spellInfo);
}

function injectAuthorName(html, messageData) {
  if (messageData.author === undefined) return;
  if (game.settings.get("pf2e-dorako-ux", "other.enable-player-tags")) {
    const messageSenderElem = html.find(".sender-wrapper");
    const playerName = messageData.author.name;
    const playerNameElem = document.createElement("span");
    playerNameElem.appendChild(document.createTextNode(playerName));
    playerNameElem.classList.add("player-name");
    playerNameElem.classList.add("header-meta");
    if (playerName === messageData.alias) {
      html.find(".message-sender").addClass("dorako-display-none");
    }
    messageSenderElem.append(playerNameElem);
  }
}

function injectMessageTag(html, messageData) {
  const setting = game.settings.get("pf2e-dorako-ux", "other.enable-rolltype-indication");
  if (setting == false) {
    return;
  }
  const messageMetadata = html.find(".message-metadata");

  const rolltype = $("<span>");
  rolltype.addClass("rolltype");
  rolltype.addClass("header-meta");

  const whisperTargets = messageData.message.whisper;

  const isBlind = messageData.message.blind;
  if (isBlind) rolltype.addClass("blind");
  const isWhisper = whisperTargets?.length > 0;
  if (isWhisper && !isBlind) rolltype.addClass("whisper");
  const isSelf = isWhisper && whisperTargets.length === 1 && whisperTargets[0] === messageData.message.user;
  const isRoll = messageData.message.rolls !== undefined;

  if (isBlind) {
    rolltype.text(i18n("pf2e-dorako-ux.text.secret"));
    messageMetadata.prepend(rolltype);
  } else if (isSelf && whisperTargets[0]) {
    rolltype.text(i18n("pf2e-dorako-ux.text.self-roll"));
    messageMetadata.prepend(rolltype);
  } else if (isRoll && isWhisper) {
    rolltype.text(i18n("pf2e-dorako-ux.text.gm-only"));
    messageMetadata.prepend(rolltype);
  } else if (isWhisper) {
    rolltype.text(i18n("pf2e-dorako-ux.text.whisper"));
    messageMetadata.prepend(rolltype);
  }

  if (game.settings.get("pf2e-dorako-ux", "moving.animate-messages")) {
    // Draw attention to direct whispers from players to GM
    const isGmSpeaker = game.users.get(messageData.message.user)?.isGM;
    const isGmTarget = game.users.get(whisperTargets?.[0])?.isGM;
    if (!(isBlind || isSelf) && isWhisper && !isGmSpeaker && isGmTarget) {
      html[0].classList.add("attention");
    }
  }
}

function injectWhisperParticipants(html, messageData) {
  const alias = messageData.alias;
  const author = messageData.author;
  const whisperTargets = messageData.message.whisper;
  const whisperTargetString = messageData.whisperTo;
  const whisperTargetIds = messageData.message.whisper;
  const isWhisper = whisperTargetIds?.length > 0 || false;
  const isRoll = messageData.message.rolls !== undefined;
  const isSelf =
    (isWhisper && whisperTargets.length === 1 && whisperTargets[0] === messageData.message.user) ||
    (isWhisper &&
      whisperTargets.length === 2 &&
      whisperTargets[0] === "null" &&
      whisperTargets[1] === messageData.message.user);

  const authorId = messageData.message.user;
  const userId = game.user.id;

  if (!isWhisper) return;
  if (userId !== authorId && !whisperTargetIds.includes(userId)) return;

  // remove the old whisper to content, if it exists
  html.find(".whisper-to").detach();

  // if this is a roll
  if (isRoll || isSelf) return;

  const messageHeader = html.find(".message-header");

  const whisperParticipants = $("<span>");
  whisperParticipants.addClass("whisper-to");

  const whisperFrom = $("<span>");
  const fromText = titleCase(i18n("pf2e-dorako-ux.text.from"));
  whisperFrom.text(`${fromText}: ${alias}`);
  whisperFrom.addClass("header-meta");

  const whisperTo = $("<span>");
  const toText = titleCase(i18n("pf2e-dorako-ux.text.to")).toLowerCase();
  whisperTo.text(`${toText}: ${whisperTargetString}`);
  whisperTo.addClass("header-meta");

  whisperParticipants.append(whisperFrom);
  whisperParticipants.append(whisperTo);
  messageHeader.append(whisperParticipants);
}

function addAvatarsToFlags(message) {
  let combatantImg =
    game.modules.get("combat-tracker-images")?.active && message.actor
      ? message.actor.getFlag("combat-tracker-images", "trackerImage")
      : null;
  let speaker = message.speaker;
  const token = game.scenes.get(speaker.scene)?.tokens.get(speaker.token);
  let tokenImg = token?.texture.src;
  const actor = game.actors.get(speaker.actor);
  let actorImg = actor?.img;
  let userImg = message.user?.avatar;

  let userAvatar = new Avatar(message.speaker.alias, userImg);

  let combatantAvatar = combatantImg ? new CombatantAvatar(message.speaker.alias, combatantImg) : null;

  let actorAvatar = actorImg ? new ActorAvatar(message.speaker.alias, actorImg) : null;

  let tokenAvatar = null;
  if (tokenImg) {
    tokenAvatar = new TokenAvatar(message.speaker.alias, tokenImg, token.texture.scaleX, actor.size == "sm");
  }

  message.updateSource({
    "flags.pf2e-dorako-ux.userAvatar": userAvatar,
    "flags.pf2e-dorako-ux.combatantAvatar": combatantAvatar,
    "flags.pf2e-dorako-ux.tokenAvatar": tokenAvatar,
    "flags.pf2e-dorako-ux.actorAvatar": actorAvatar,
  });
}

function getAvatar(message) {
  const source = game.settings.get("pf2e-dorako-ux", "avatar.source");
  if (source == "none") {
    return null;
  }

  let combatantAvatar = message.getFlag("pf2e-dorako-ux", "combatantAvatar");
  let tokenAvatar = message.getFlag("pf2e-dorako-ux", "tokenAvatar");
  let actorAvatar = message.getFlag("pf2e-dorako-ux", "actorAvatar");
  let userAvatar = game.settings.get("pf2e-dorako-ux", "avatar.use-user-avatar")
    ? message.getFlag("pf2e-dorako-ux", "userAvatar")
    : null;

  if (combatantAvatar) return combatantAvatar;

  if (
    game.settings.get("pf2e-dorako-ux", "avatar.hide-when-token-hidden") &&
    message.getFlag("pf2e-dorako-ux", "wasTokenHidden")
  ) {
    return null;
  }

  return source == "token" ? tokenAvatar || actorAvatar || userAvatar : actorAvatar || tokenAvatar || userAvatar;
}

// Add avatar if message contains avatar data
Hooks.on("renderChatMessage", (message, b) => {
  let avatar = getAvatar(message);
  if (!avatar) return;
  let html = b[0];

  let avatarElem = html.getElementsByClassName("avatar")[0];
  if (!avatarElem) return;

  avatarElem.src = avatar.image;

  if (avatar.type == "token") {
    const smallScale = game.settings.get("pf2e-dorako-ux", "avatar.small-creature-token-avatar-size");
    let smallCorrection = avatar.isSmall ? 1.25 * smallScale : 1;
    avatarElem?.setAttribute("style", "transform: scale(" + Math.abs(avatar.scale) * smallCorrection + ")");
  }

  const portraitDegreeSetting = game.settings.get("pf2e-dorako-ux", "avatar.reacts-to-degree-of-success");

  if (portraitDegreeSetting && message.isContentVisible) {
    let outcome = message?.flags?.pf2e?.context?.outcome;
    if (outcome === undefined) return;
    if (outcome === "criticalFailure") {
      let wrapper = html.getElementsByClassName("portrait-wrapper")[0];
      wrapper?.setAttribute("style", "filter: saturate(0.2) drop-shadow(0px 0px 6px black)");
    } else if (outcome === "criticalSuccess") {
      let wrapper = html.getElementsByClassName("portrait-wrapper")[0];
      wrapper?.setAttribute("style", "filter: drop-shadow(0px 0px 6px lightgreen)");
    }
  }
});

// Add .spell to spells
Hooks.on("renderChatMessage", (app, html, data) => {
  const item = app?.item;
  if (!item) return;
  if (!item.constructor.name.includes("SpellPF2e")) return;
  html[0].classList.add("spell");
});
