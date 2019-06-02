//@SequenceName: Cosplay Farming

// What this will do:
// - Go to BillyCon
// - Register using options that maximize available monies
// - Pack duplicate cosplays pieces and fill the rest of available space with
//   omnoms.   
// - At the actual con, it will go to Dealer's Room when possible and there
//   are still monies.
// - It will buy whatever cosplay piece is available while prioritizing
//   those not already owned.
// - When hungry, it will eat omnoms or go to food court.
// - When stuffsed, it will crash in room.
// - When Dealer's Room isn't available, it will do cosplay swaps with
//   a hopefully reasonable choice of filters and using flow when available.
//   It will only pick offers of exchanging redundant stuff for new stuff.

//@SequenceCode

// If this is set to 1, no actions will be taken. 
// Decisions will be made and forms will be filled, but a message will be
// printed instead of actually submitting the form. Also, some debugging info
// will be printed to the console.
// If set to 2, slightly more debugging info will get printed.
var debuglevel = 2;

function dbg(lvl, ...msg) {
    if (debuglevel >= lvl)
        console.log(...msg);
}

function DocRegex(re, idx) {
    dbg(2, 'Regexing: ' + re);
    var result = re.exec(document.body.innerText);
    dbg(2, 'Regex result: ' + result);
    if (idx == undefined || typeof idx != 'number' || result == null) {
        return result;
    } else {
        return result[idx];
    }
}

function DocReInt(re) {
    return parseInt(DocRegex(re, 1));
}

// Just a debugging wrapper around FormSubmit
function FormAction(formName) {
    if (debuglevel)
        ShowMsg('Would submit form: ' + formName);
    FormSubmit(formName);
}

function BvSPlayerId() {
    return $('input[name=player]').value;
}

//
// Stuff for convenient local storage access
//
function StorageProxy(localstorage_prefix) {
    var handler = {
        set(target, prop, newval) {
            dbg(2, `Storage: Setting ${localstorage_prefix}.${prop} to:`, 
                newval);
            localStorage.setItem(`${localstorage_prefix}.${prop}`, 
                                 JSON.stringify(newval));
            return true;
        },
        get(target, prop) {
            var ret = JSON.parse(
                localStorage.getItem(`${localstorage_prefix}.${prop}`));
            dbg(2, `Storage: Getting from ${localstorage_prefix}.${prop}:`,
                ret);
            return ret;
        },
        deleteProperty(target, prop) {
            dbg(2, `Storage: Removing ${localstorage_prefix}.${prop}`);
            localStorage.removeItem(`${localstorage_prefix}.${prop}`);
            return true;
        }
    };
    return new Proxy({}, handler);
}

function ScriptStorage() {
    return StorageProxy('cosplay-farmer-' + BvSPlayerId());
}

// 
// XPath and QuerySelector helpers
//
function $x(xpath, context=document) {
    var result = document.evaluate(xpath, context, null, 
                                   XPathResult.ANY_UNORDERED_NODE_TYPE, null);
    return result.singleNodeValue;
}

function $$x(xpath, context=document) {
    var result = document.evaluate(xpath, context, null,
                                   XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                                   null);
    var retarr = [];
    var res;
    while ((res = result.iterateNext()))
        retarr.push(res);
    return retarr;
}

function $(selector, context=document) {
    return context.querySelector(selector);
}

function $$(selector, context=document) {
    return Array.from(context.querySelectorAll(selector));
}

//
// Stuff for dealing with con packing page
//

// Cosplay list on packing page
function parseCosplayList() { 
    var labels = $$('ul.checklist label');
    var pieces = [];
    for (let l of labels) {
        dbg(2, `Parsing label: ${l.innerText}`);
        let [piece, stat] = l.innerText.split('(')
                            .slice(0,2).map((s) => s.trim());
        let qtyTest = /Qty: (\d+)/.exec(stat);
        var qty = 1;
        if (qtyTest)
            qty = parseInt(qtyTest[1]);
        let checkid = l.getAttribute('for');
        dbg(1, `Parsed cosplay piece: ${piece} (Qty: ${qty})`);
        pieces.push({piece, qty, checkid});
    }
    return pieces;
}

// Packing page
function parseConPacking() {
    dbg(1, '==== Parsing con packing page ====');
    var list = parseCosplayList();
    var totalSpace = DocReInt(/You may bring up to (\d+) Spaces' worth/);
    return { list, totalSpace };
}

// Selects duplicates up to capacity, returns array of selected things;
function packDuplicateCosplays(list, max=0) {
    var packed = [];
    var numPacked = 0;
    $$('ul.checklist input[type=checkbox').forEach(
        (chk) => chk.checked = false);
    for (let item of list) {
        let {piece, qty, checkid} = item;
        if (max <= 0)
            break;
        if (qty > 1) {
            dbg(1, `Packing cosplay piece: ${piece}`);
            max -= 1;
            packed.push(item);
            $(`#${checkid}`).checked = true;
        }
    }
    return packed;
}

function inventoryFromList(list) {
    var inv = {};
    list.forEach((item) => inv[item.piece] = item.qty);
    return inv;
}

function doConPacking() {
    var info = parseConPacking();
    var packed = packDuplicateCosplays(info.list, info.totalSpace);
    var spaceLeft = info.totalSpace - packed.length;
    // Filling remaining space with noms
    FormSetValue('conroom', 'pack-xf', 
                 Math.min(3, Math.floor(spaceLeft / 2)));
    var store = ScriptStorage();
    // Remember this for later
    store.inventory = inventoryFromList(info.list);
    // We might want to track how many non-duplicates we have
    // as the con progresses.
    store.totalPacked = packed.length;
    store.uniquePacked = 0;
    FormAction('conroom');
}

// TODO: test if this works at noon and at midnight
function parseTime(timeStr) {
    if (timeStr === 'Noon') {
        return 12;
    } else if (timeStr === 'Midnight') {
        return 24;
    } else if (timeStr === 'LATE') {
        return 25;
    } else {
        let [hour, dayhalf] = timeStr.split(' ');
        return parseInt(hour) + 12 * (dayhalf === 'PM');
    }
}

function hoursTillEnd(day, timeStr) {
    const dayRanges = [[12, 25], [9, 25], [9, 17]];
    var hoursLeft = 0;
    var time = parseTime(timeStr);
    dbg(2, `Parsed ${timeStr} as ${time}`);
    for (let i = day - 1; i < 3; ++i) {
        time = Math.max(time, dayRanges[i][0]);
        hoursLeft += dayRanges[i][1] - time;
        time = 0;
    }
    return hoursLeft;
}

// Parsing main con page
function parseConMain() {
    dbg(1, '==== Parsing main con page ====');
    // Noms
    var nom = parseInt(
        $('table.constats tbody').children[1].children[1].innerText);
    // Monies
    var monies = parseInt(
        $('table.constats tbody').children[1].children[3].innerText);
    // Flow
    var flow = parseInt(
        $('table.constats tbody').children[1].children[7].innerText);
    var day = parseInt(
        $('table.constats tbody').children[1].children[5].innerText);
    var timeStr = $('table.constats tbody').children[1].children[6].innerText;
    var hoursLeft = hoursTillEnd(day, timeStr);
    dbg(1, `Nom: ${nom}; Monies: ${monies}; Flow: ${flow};`
           +` Day: ${day}; Time: ${timeStr}; Con hours left: ${hoursLeft}`); 
    // Can go to dealer's room?
    var dealerRoomOk = ($('option[value=deal]') != null);
    // Are omnoms available?
    var omnomsOk = ($('input[value=eatnom]') != null);
    // Are we stuffsed?
    var stuffsed = (DocRegex(/Stuffsed! -1 to all rolls!/) != null);
    dbg(1, `Dealer's room available: ${dealerRoomOk};`
           + ` Omnoms available: ${omnomsOk}; Stuffsed: ${stuffsed}`);
    // Did we just get cosplay swap offers?
    var swapOffers = [];
    for (let l of $$('form[name=cosswap] label')) {
        dbg(1, `Parsing cosplay swap offer: ${l.innerText}`);
        let checkid = l.getAttribute('for');
        let [yours, theirs] = l.innerText.split('for their');
        // The \s in the regexes below is because unbreakable spaces 
        // (unicode codepoint U+00A0) occur in page text and they won't match a
        // normal one.
        let [your_piece, your_num] = 
            /Your ([^(]+)[(][^(]*[(]You\shave\s(\d+)/.exec(yours)
            .slice(1).map((s) => s.trim());
        let [their_piece, their_num] =
            /([^(]+)[(][^(]*[(]You\shave\s(\d+)/.exec(theirs)
            .slice(1).map((s) => s.trim());
        [your_num, their_num] = [your_num, their_num].map((s) => parseInt(s));
        dbg(1, `Parsed: ${your_piece} (we have: ${your_num})`
               + ` for ${their_piece} (we have: ${their_num})`);
        swapOffers.push({your_piece, your_num, their_piece, their_num
                        ,checkid});
    }
    // Did we just buy a cosplay piece?
    var justBought = null;
    var purchaseMsgNode = 
        $x('//td/i[b[text()="Purchased!"]]/following-sibling::i/b');
    if (purchaseMsgNode) {
        let purchaseMsg = purchaseMsgNode.innerText;
        let piece = purchaseMsg.slice(0, -10);
        if (purchaseMsg.endsWith('Received!') &&
                (piece.endsWith('Body') || piece.endsWith('Head')
                 || piece.endsWith('Prop')))
            justBought = piece;
        dbg(1, `Purchased: ${piece}`);
    }
    // Did we just swap cosplay pieces?
    var justSwapped = ($x('//b[text()="Swapped!"]') != null);
    dbg(1, `Swapped cosplay: ${justSwapped}`);
    // Did we just get dealer's room offers?
    var dealerOffers = [];
    for (let l of $$('form[name=condroom] label')) {
        dbg(1, `Parsing dealer's room offer: ${l.innerText}`);
        if (!/Cosplay Piece/.test(l.innerText)) {
            dbg(1, 'Skipped');
            continue;
        }
        let [rawset, rawrest] = l.innerText.split('Cosplay Piece');
        let set = rawset.trim();
        let price = parseInt(/^\s*(\d+)M/.exec(rawrest)[1]);
        let part = /[(](\S+) Piece/.exec(rawrest)[1];
        let checkid = l.getAttribute('for');
        let piece = set + ' ' + part;
        dbg(1, `Parsed: ${piece} (price: ${price})`);
        dealerOffers.push({piece, price, checkid});
    }
    return { nom, monies, flow, dealerRoomOk, omnomsOk, swapOffers
           , dealerOffers, justSwapped, justBought, stuffsed
           , day, timeStr, hoursLeft };
}

function doConMain() {
    var pageData = parseConMain();
    var store = ScriptStorage();
    if (!$('#cosplay-farmer-did-inv-update')
            && (pageData.justSwapped || pageData.justBought)) {
        dbg(1, '---- Updating inventory info ----');
        if (pageData.justSwapped) {
            // Assumption that we only swap for new things
            // We don't know what we swapped, so inventory info will grow
            // inaccurate over time.
            store.uniquePacked += 1;
        } else {
            let piece = pageData.justBought;
            let inv = store.inventory || {};
            let have = inv[piece] || 0;
            store.totalPacked += 1;
            if (have++ === 0) {
                store.uniquePacked += 1;
            } else {
                store.uniquePacked -= 1;
            }
            inv[piece] = have;
            store.inventory = inv;
        }
        // Put a marker into the DOM to avoid updating several times
        let marker_el = document.createElement('span');
        marker_el.setAttribute('id', 'cosplay-farmer-did-inv-update');
        marker_el.style.display = 'none';
        document.body.appendChild(marker_el);
    }
    dbg(1, '---- Deciding what to do ----');
    // Check if we have swap offers and maybe pick a good one
    if (pageData.swapOffers.length > 0) {
        for (let off of pageData.swapOffers) {
            dbg(2, 'Considering swap offer:', off);
            if (off.your_num > 1 && off.their_num === 0) {
                dbg(1, `Swapping ${off.your_piece} for ${off.their_piece}`);
                $(`#${off.checkid}`).checked = true;
                FormAction('cosswap');
            }
        }
    }
    // Check if we have dealer's offers and also maybe pick
    if (pageData.dealerOffers.length > 0) {
        let chosenOffer = pageData.dealerOffers[0];
        for (let off of pageData.dealerOffers) {
            // Prefer things we don't have
            if (!(store.inventory || {})[off.piece]) {
                chosenOffer = off;
                break;
            }
        }
        dbg(1, `Buying ${chosenOffer.piece}`);
        $(`#${chosenOffer.checkid}`).checked = true;
        FormAction('condroom');
    }
    // Fix stuffsedness
    if (pageData.stuffsed) {
        dbg(1, 'We are stuffsed. Crashing in room.');
        FormCheck('conaction', 'conaction', 'roomcrash');
        FormAction('conaction');
    }
    // Eat food if hungry
    if (pageData.nom <= 0) {
        dbg(1, 'Dealing with hunger');
        if (pageData.omnomsOk) {
            FormCheck('conaction', 'conaction', 'eatnom');
            dbg(1, '  Through omnoms');
        } else {
            FormCheck('conaction', 'conaction', 'foodcourt');
            dbg(1, '  Through food court');
        }
        FormAction('conaction');
    }
    // Check if we can go to dealer's room and if there's any point
    if (pageData.dealerRoomOk && pageData.monies >= 5) {
        dbg(1, "Going to Dealer's Room");
        FormSelect('conaction', 'eventpick', 'deal');
        FormCheck('conaction', 'conaction', 'event');
        FormAction('conaction');
    }
    // Otherwise, cosplay swaps until it's done
    // This part might require some strategic tweaking
    dbg(1, 'Doing cosplay swap');
    // First, disable all fiters, just in case
    $$('label[for=conswap] input[type=checkbox]').forEach(
        (chkbox) => chkbox.checked = false);
    // Enable the 'new' filter. I think this makes sense if you already own
    // most cosplay pieces that are out there. Otherwise, 'extra' might be
    // better, maybe.
    FormCheck('conaction', 'cosswap-a');
    // Check if we have flow
    if (pageData.flow > 0) {
        dbg(1, 'Considering using flow...');
        // Now, we could just use flow to activate the 'extra' filter. 
        // But if a large proportion of cosplay pieces we're currently
        // carrying are such that we own at least 2 of them, then this might
        // be a waste of flow.
        // So, using flow is delayed until the last moment when it can still
        // be spent. Some margin of error could be added here.
        if (pageData.flow >= pageData.hoursLeft) {
            dbg(1, '  Using flow');
            FormCheck('conaction', 'useflow');
            FormCheck('conaction', 'cosswap-c');
        } else {
            dbg(1, '  Not using flow');
        }
    }
    FormCheck('conaction', 'conaction', 'conswap');
    FormAction('conaction');
}

//
// Stuff for figuring out where we are
//

// TODO: next weekend test if conlate and connextday work
function recognizePage() {
    if (LocationTest('/bvs/billycon-register.html')) {
        return 'conregister';
    } else if (LocationTest('/bvs/billycon.html')) {
        if (DocRegex(/Leave the Con: Gives Fond Memories Effect/)) {
            return 'conleaving';
        } else if (DocTest('The Con is done for the night!')) {
            return 'conlate';
        } else if (DocTest('Available Actions')) {
            return 'conmain';
        } else if (DocTest('You take off from the convention center'
                          +' back to the real world')) {
            return 'confinished';
        } else if (DocTest('Choose your Convention Room!')) {
            return 'conprep';
        } else if (DocRegex(
                /You may bring up to (\d+) Spaces' worth of/)) {
            return 'conpack';
        } else if (DocTest('Your starting setup:')) {
            return 'conconfirm';
        } else if (DocTest('You enter the con, ready for anything!')) {
            // Just how many dumb confirmation screens are there
            return 'conenter';
        } else if (DocRegex(/Continue to day \d/)) {
            // A lot, apparently
            return 'connextday';
        }
    } else if (LocationTest('/bvs/billycon-character.html')) {
        return 'constats';
    } else {
        return 'unknown';
    }
}

//@NewTask
//@TaskName: Do the thing

var currentPage = recognizePage();
dbg(1, `Identifying current page: ${currentPage}`);

// XXX: needs to be tested next weekend
IncrementTaskIf(currentPage === 'confinished' || currentPage === 'conlate');

if (currentPage === 'conregister') {
    if (DocTest('Get to the Con!'))
        FormSubmit('gotocon');
    ShowMsg('Register manually');
}

if (currentPage === 'conprep') {
    // XXX: needs to be tested next weekend
    // Con hotel
    FormCheck('conroom', 'distance', 2);
    // Own room
    FormCheck('conroom', 'roomies', 2);
    // Jump the line
    FormCheck('conroom', 'waitline', 2);
    FormAction('conroom');
}

if (currentPage === 'conpack') {
    doConPacking();
}

if (currentPage === 'connextday') {
    // XXX: needs to be tested next weekend
    FormAction('conroom');
}

if (currentPage === 'conconfirm' || currentPage === 'conenter') {
    FormAction('conroom');
}

if (currentPage === 'conmain') {
    doConMain();
}

if (currentPage === 'conleaving') {
    let inp = $('input[type=radio][value=lmbargains]');
    if (inp) {
        dbg(1, 'Last minute bargain');
        inp.checked = true;
        FormAction('conaction');
    }
    // Last minute wanders?
    FormCheck('conaction', 'conaction', 'gohome');
    FormAction('conaction');
}

GoPage('billycon');
