(function () {
  "use strict";
  var C = window.KK || {}, LIVE = !!(C.shop && C.token), P = document.body.dataset.page || "";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var inr = function (n) { return "\u20B9" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); };
  var ls = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del: function (k) { try { localStorage.removeItem(k); } catch (e) {} } };
  var byHandle = {};

  /* ---------- Shopify Storefront API ---------- */
  function gql(q, v) {
    return fetch("https://" + C.shop + "/api/2026-10/graphql.json", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": C.token },
      body: JSON.stringify({ query: q, variables: v || {} })
    }).then(function (r) { if (!r.ok) throw new Error("Shopify error " + r.status); return r.json(); })
      .then(function (j) { if (j.errors) throw new Error(j.errors[0].message); return j.data; });
  }
  var PF = "handle title vendor productType availableForSale featuredImage{url} images(first:4){nodes{url}} descriptionHtml tags collections(first:12){nodes{title handle}} priceRange{minVariantPrice{amount}} compareAtPriceRange{minVariantPrice{amount}} variants(first:10){nodes{id title availableForSale price{amount} compareAtPrice{amount}}}";
  function norm(n) {
    var vs = (n.variants.nodes || []).map(function (v) { return { id: v.id, title: v.title, price: +v.price.amount, compare: +((v.compareAtPrice || {}).amount || 0), available: v.availableForSale }; });
    var p = { handle: n.handle, title: n.title, vendor: n.vendor || "", tags: n.tags || [], collections: ((n.collections || {}).nodes || []), type: n.productType || "Toys", image: (n.featuredImage || {}).url || "/img/logo.png",
      images: (n.images.nodes || []).map(function (i) { return i.url; }), price: +n.priceRange.minVariantPrice.amount,
      compare: +((n.compareAtPriceRange.minVariantPrice || {}).amount || 0), desc: n.descriptionHtml || "", available: n.availableForSale, variants: vs, variantId: (vs[0] || {}).id };
    byHandle[p.handle] = p; return p;
  }
  // No hard-coded/demo catalog: products appear only after Shopify is connected.
  function demoList() { return Promise.resolve([]); }
  function listProducts(q) {
    if (!LIVE) return demoList().then(function (a) { q = (q || "").toLowerCase(); return q ? a.filter(function (p) { return (p.title + " " + p.type).toLowerCase().indexOf(q) > -1; }) : a; });
    function page(after, collected) {
      return gql("query($q:String,$after:String){products(first:100,after:$after,query:$q){nodes{" + PF + "} pageInfo{hasNextPage endCursor}}}", { q: q || null, after: after || null }).then(function (d) {
        var conn = d.products, items = collected.concat(conn.nodes.map(norm));
        /* Fetch every page for full catalogs and filtered searches; Shopify returns at most 100 products per request. */
        return conn.pageInfo.hasNextPage ? page(conn.pageInfo.endCursor, items) : items;
      });
    }
    return page(null, []);
  }
  function getProduct(h) {
    if (!LIVE) return demoList().then(function (a) { return a.filter(function (p) { return p.handle === h; })[0] || null; });
    return gql("query($h:String!){product(handle:$h){" + PF + "}}", { h: h }).then(function (d) { return d.product ? norm(d.product) : null; });
  }

  /* ---------- Cart ---------- */
  var CF = "fragment C on Cart{id checkoutUrl totalQuantity cost{subtotalAmount{amount}} lines(first:100){nodes{id quantity merchandise{... on ProductVariant{id title price{amount} image{url} product{title handle featuredImage{url}}}}}}}";
  function mapCart(c) {
    if (!c) return null;
    return { id: c.id, checkoutUrl: c.checkoutUrl, count: c.totalQuantity, total: +c.cost.subtotalAmount.amount, lines: c.lines.nodes.map(function (l) { var m = l.merchandise;
      return { id: l.id, qty: l.quantity, title: m.product.title, variant: m.title, image: (m.image || {}).url || (m.product.featuredImage || {}).url || "/img/logo.png", price: +m.price.amount, handle: m.product.handle }; }) };
  }
  var cart = { id: null, lines: [], count: 0, total: 0, checkoutUrl: "" };
  function setCart(c) { if (!c) { cart = { id: null, lines: [], count: 0, total: 0, checkoutUrl: "" }; ls.del("kk_cart_id"); } else { cart = c; if (LIVE) ls.set("kk_cart_id", c.id); } paint(); }
  function demoSave() { cart.count = cart.lines.reduce(function (a, l) { return a + l.qty; }, 0); cart.total = cart.lines.reduce(function (a, l) { return a + l.qty * l.price; }, 0); ls.set("kk_demo_cart", JSON.stringify(cart.lines)); paint(); }
  function loadCart() {
    if (!LIVE) { try { cart.lines = JSON.parse(ls.get("kk_demo_cart") || "[]"); } catch (e) { cart.lines = []; } demoSave(); return Promise.resolve(); }
    var id = ls.get("kk_cart_id"); if (!id) return Promise.resolve();
    return gql(CF + "query($id:ID!){cart(id:$id){...C}}", { id: id }).then(function (d) { setCart(mapCart(d.cart)); }).catch(function () { setCart(null); });
  }
  function addToCart(p, vid, qty) {
    qty = qty || 1; vid = vid || p.variantId;
    if (!LIVE) {
      var v = p.variants.filter(function (x) { return x.id === vid; })[0] || p.variants[0], ex = cart.lines.filter(function (l) { return l.id === vid; })[0];
      if (ex) ex.qty += qty; else cart.lines.push({ id: vid, qty: qty, title: p.title, variant: v.title, image: p.image, price: v.price, handle: p.handle });
      demoSave(); toast(p.title + " added to cart"); openDrawer(); return Promise.resolve();
    }
    var line = [{ merchandiseId: vid, quantity: qty }];
    var create = function () { return gql(CF + "mutation($l:[CartLineInput!]!){cartCreate(input:{lines:$l}){cart{...C} userErrors{message}}}", { l: line }).then(function (d) { return d.cartCreate; }); };
    var run = cart.id ? gql(CF + "mutation($c:ID!,$l:[CartLineInput!]!){cartLinesAdd(cartId:$c,lines:$l){cart{...C} userErrors{message}}}", { c: cart.id, l: line }).then(function (d) { return d.cartLinesAdd; }).then(function (r) { return r.cart ? r : create(); }) : create();
    return run.then(function (r) { if (!r.cart) throw new Error((r.userErrors[0] || {}).message || "Could not add"); setCart(mapCart(r.cart)); toast(p.title + " added to cart"); openDrawer(); })
      .catch(function (e) { toast(e.message || "Could not add to cart", 1); });
  }
  function changeQty(id, qty) {
    if (!LIVE) { cart.lines = cart.lines.filter(function (l) { if (l.id === id) { l.qty = qty; } return l.qty > 0; }); return demoSave(); }
    var q = qty > 0
      ? gql(CF + "mutation($c:ID!,$i:ID!,$q:Int!){cartLinesUpdate(cartId:$c,lines:[{id:$i,quantity:$q}]){cart{...C}}}", { c: cart.id, i: id, q: qty }).then(function (d) { return d.cartLinesUpdate.cart; })
      : gql(CF + "mutation($c:ID!,$i:ID!){cartLinesRemove(cartId:$c,lineIds:[$i]){cart{...C}}}", { c: cart.id, i: id }).then(function (d) { return d.cartLinesRemove.cart; });
    q.then(function (c) { setCart(mapCart(c)); }).catch(function (e) { toast(e.message, 1); });
  }

  /* ---------- UI: toast, drawer, header/footer ---------- */
  function toast(msg, bad) { var t = document.createElement("div"); t.className = "kk-toast" + (bad ? " bad" : ""); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove(); }, 400); }, 2600); }
  function openDrawer() { var d = $("#kk-drawer"); if (d) d.classList.add("open"); }
  function closeDrawer() { var d = $("#kk-drawer"); if (d) d.classList.remove("open"); }
  function buildDrawer() {
    var d = document.createElement("div"); d.id = "kk-drawer";
    d.innerHTML = '<div class="kk-shade"></div><aside role="dialog" aria-label="Shopping cart"><header><h3>Your Cart</h3><button class="kk-x" aria-label="Close cart">&times;</button></header><div class="kk-lines"></div><footer></footer></aside>';
    document.body.appendChild(d);
    d.addEventListener("click", function (e) {
      var t = e.target;
      if (t.classList.contains("kk-shade") || t.classList.contains("kk-x")) return closeDrawer();
      var b = t.closest("[data-q]"); if (b) changeQty(b.dataset.id, +b.dataset.q);
      if (t.id === "kk-checkout") { if (LIVE && cart.checkoutUrl) window.location.href = cart.checkoutUrl; else toast("Demo mode: add your Shopify store details in js/config.js to enable checkout", 1); }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });
  }
  function paint() {
    $$(".kk-count").forEach(function (n) { n.textContent = cart.count; n.style.display = cart.count ? "" : "none"; });
    var L = $("#kk-drawer .kk-lines"), F = $("#kk-drawer footer"); if (!L) return;
    if (!cart.lines.length) { L.innerHTML = '<p class="kk-empty">Your cart is empty.<br><a class="kk-btn" href="/shop.html">Start shopping</a></p>'; F.innerHTML = ""; return; }
    L.innerHTML = cart.lines.map(function (l) { return '<div class="kk-line"><img src="' + esc(l.image) + '" alt=""><div><a href="/product.html?handle=' + encodeURIComponent(l.handle) + '">' + esc(l.title) + '</a>' + (l.variant && l.variant !== "Default Title" ? '<small>' + esc(l.variant) + '</small>' : "") + '<b>' + inr(l.price) + '</b>' +
      '<div class="kk-qty"><button data-id="' + esc(l.id) + '" data-q="' + (l.qty - 1) + '" aria-label="Decrease">&minus;</button><span>' + l.qty + '</span><button data-id="' + esc(l.id) + '" data-q="' + (l.qty + 1) + '" aria-label="Increase">+</button><button class="kk-rm" data-id="' + esc(l.id) + '" data-q="0">Remove</button></div></div></div>'; }).join("");
    var left = Math.max(0, (C.freeShipFrom || 999) - cart.total), pct = Math.min(100, cart.total / (C.freeShipFrom || 999) * 100);
    F.innerHTML = '<div class="kk-ship">' + (left ? "Add " + inr(left) + " more for free delivery" : "You've unlocked free delivery!") + '<i><u style="width:' + pct + '%"></u></i></div><div class="kk-sub"><span>Subtotal</span><b>' + inr(cart.total) + '</b></div><small>Taxes and shipping calculated at checkout.</small><button id="kk-checkout" class="kk-btn kk-full">Checkout</button>';
  }
  function chrome() {
    var h = document.createElement("header"); h.className = "kk-head";
    var headerGroups = [
      ["SHOP BY CATEGORY", ["Musical Toys","Learning & Educational Toys","Soft Toys","Indoor & Outdoor Play","Play Gyms & Playmats","Sports & Games","Role & Pretend Play Toys","Blocks & Construction Sets","Stacking Toys","Kids Puzzles","Baby Rattles","Toys Cars Trains & Vehicles","Kids Musical Instruments","Dolls & Dollhouses","Push & Pull Along Toys","Art Crafts & Hobby Kits","Board Games","Novelty Toys NEW","Magnetic Toys NEW","Action Figures & Collectibles","Radio & Remote Control Toys","Bath Toys","Toys Guns & Weapons","PC Games & Gaming Consoles","Kids Gadgets NEW"]],
      ["RIDE-ONS & SCOOTERS", ["Battery Operated Ride-ons","Manual Push Ride-ons","Swing cars/twisters","Scooters","Rocking Ride Ons","Tricycles","Bicycles","Balance Bike"]],
      ["COMBO PACKS", ["Combo Packs"]],
      ["BOARD GAMES", ["IQ Games","Ludo, Snakes & Ladders","Words, Pictures & Scrabble Games","Playing Cards","Life & Travel Board Games","Animal, Birds & Marine Life Games","Business/Monopoly"]],
      ["HOME PLAY ACTIVITIES", ["Play Dough, Sand & Moulds","Coloring, Sequencing & Engraving Art","Activity Kit","Building Construction Sets","Multi Model Making Sets","Kitchen Sets","Play Foods","Kids' Doctor Sets","Piano & Keyboards","Drum Sets & Percussion"]],
      ["SHOP BY BRANDS", ["Babyhug","Intelliskills","Intellibaby","Fab n Funky","Hotwheels","Disney","Barbie","Giggles","Lego","Bonfino","Pine Kids","Playnation","Doodle Poodle"]],
      ["SHOP BY PRICE", ["Under 299","Under 499","Under 699","Under 999","Favourite Toys"]]
    ];
    function categoryHref(label, groupIndex) {
      if (groupIndex === 5) return '/shop?vendor=' + encodeURIComponent(label);
      if (groupIndex === 6 && /^Under /.test(label)) return '/shop?max=' + encodeURIComponent(label.replace(/[^0-9]/g,''));
      if (label === 'Favourite Toys') return '/shop?sort=favourite';
      return '/shop?category=' + encodeURIComponent(label);
    }
    h.innerHTML = '<div class="kk-wrap"><a href="/" class="kk-logo"><img src="/img/logo.png" alt="KhelKhilone"></a><nav><a href="/">Home</a><div class="kk-nav-categories"><button type="button" class="kk-category-trigger" aria-expanded="false">Categories ▾</button><div class="kk-category-menu">' + headerGroups.map(function(gr, gi) { return '<section><strong>' + esc(gr[0]) + '</strong>' + gr[1].map(function(label) { return '<a href="' + categoryHref(label, gi) + '">' + esc(label) + '</a>'; }).join('') + '</section>'; }).join('') + '</div></div><a href="/shop.html">Shop</a><a href="/#contact">Contact</a></nav>' +
      '<form action="/shop.html" class="kk-search"><input name="q" type="search" placeholder="Search toys" aria-label="Search toys"><button aria-label="Search">&#128269;</button></form>' +
      '<button class="kk-cartbtn" aria-label="Open cart">&#128722;<span class="kk-count" style="display:none">0</span></button></div>';
    var categoryButton = h.querySelector('.kk-category-trigger');
    categoryButton.addEventListener('click', function() { var menu = h.querySelector('.kk-category-menu'), open = menu.classList.toggle('is-open'); categoryButton.setAttribute('aria-expanded', String(open)); });
    var searchForm = h.querySelector('.kk-search'), searchInput = searchForm && searchForm.querySelector('input');
    if (searchForm && searchInput) {
      searchForm.style.position = 'relative';
      var suggest = document.createElement('div'); suggest.className = 'kk-search-suggestions'; suggest.hidden = true; suggest.setAttribute('role','listbox');
      suggest.style.cssText = 'position:absolute;top:100%;left:0;right:0;z-index:10000;background:#fff;border:1px solid #ddd;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);max-height:360px;overflow:auto;color:#222;';
      searchForm.appendChild(suggest); var searchTimer = null, lastSearch = '';
      searchInput.setAttribute('autocomplete','off');
      searchInput.addEventListener('input', function(){
        var term = searchInput.value.trim(); clearTimeout(searchTimer);
        if (term.length < 2) { suggest.hidden = true; suggest.innerHTML = ''; return; }
        searchTimer = setTimeout(function(){ if(term === lastSearch) return; lastSearch = term;
          listProducts(term).then(function(items){ if(searchInput.value.trim() !== term) return;
            var needle = term.toLowerCase(); items = items.filter(function(x){return (x.title+' '+x.type+' '+(x.vendor||'')+' '+((x.tags||[]).join(' '))).toLowerCase().indexOf(needle)!==-1;}).slice(0,8);
            suggest.innerHTML = items.length ? items.map(function(x){return '<a role="option" href="/product.html?handle='+encodeURIComponent(x.handle)+'" style="display:flex;align-items:center;gap:10px;padding:9px 12px;text-decoration:none;color:inherit;border-bottom:1px solid #eee"><img src="'+esc(x.image)+'" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:6px"><span style="flex:1">'+esc(x.title)+'<small style="display:block;opacity:.7">'+esc(x.type)+'</small></span><b>'+inr(x.price)+'</b></a>';}).join('') : '<div style="padding:12px">No matching Shopify products found</div>';
            suggest.hidden = false;
          }).catch(function(){ suggest.innerHTML='<div style="padding:12px">Search is temporarily unavailable. Press Enter to try the full search.</div>'; suggest.hidden=false; });
        }, 220);
      });
      document.addEventListener('click',function(e){if(!searchForm.contains(e.target))suggest.hidden=true;});
      searchInput.addEventListener('keydown',function(e){if(e.key==='Escape')suggest.hidden=true;});
    }
    document.body.insertBefore(h, document.body.firstChild);
    var f = document.createElement("footer"); f.className = "kk-foot"; f.id = "contact";
    f.innerHTML = '<div class="kk-wrap"><div><img src="/img/logo.png" alt="KhelKhilone" class="kk-flogo"></div><div><h4>Visit us</h4><p>' + esc(C.address) + '</p><p><a href="tel:' + esc(C.phone.replace(/\s/g, "")) + '">' + esc(C.phone) + '</a></p><p><a href="' + esc(C.maps) + '" target="_blank" rel="noopener">Get directions</a></p></div>' +
      '<div><h4>Rated 4.7 &#9733;</h4><p><a href="' + esc(C.reviews) + '" target="_blank" rel="noopener">218 Google reviews</a></p><p>Toy store in Akola, Maharashtra</p></div></div><p class="kk-copy">Copyright 2026 KhelKhilone. All Rights Reserved.</p>';
    document.body.appendChild(f);
  }
  var card = function (p) { var off = p.compare > p.price ? Math.round(100 - p.price / p.compare * 100) : 0;
    return '<article class="kk-card"><a href="/product.html?handle=' + encodeURIComponent(p.handle) + '" class="kk-img"><img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" loading="lazy">' + (off ? '<span class="kk-off">OFF ' + off + '%</span>' : "") + (p.available ? "" : '<span class="kk-sold">Sold out</span>') + '</a><small>' + esc(p.type) + '</small><h3><a href="/product.html?handle=' + encodeURIComponent(p.handle) + '">' + esc(p.title) + '</a></h3><div class="kk-pr"><b>' + inr(p.price) + '</b>' + (off ? '<s>' + inr(p.compare) + '</s>' : "") + '</div><button class="kk-btn kk-add" data-h="' + esc(p.handle) + '"' + (p.available ? "" : " disabled") + '>' + (p.available ? "Add to cart" : "Sold out") + '</button></article>'; };
  var fail = function (el, e) { el.innerHTML = '<p class="kk-msg">Could not load products right now (' + esc(e.message) + '). <button class="kk-btn" onclick="location.reload()">Try again</button></p>'; };

  /* ---------- Pages ---------- */
  function shopPage() {
    var g = $("#kk-grid"), qs = new URLSearchParams(location.search), q = qs.get("q") || "", category = (qs.get("category") || qs.get("type") || "").trim(), age = (qs.get("age") || "").trim(), vendor = (qs.get("vendor") || "").toLowerCase(), maxPrice = parseFloat(qs.get("max") || "0") || 0, favourite = qs.get("sort") === "favourite", minDiscount = Math.max(0, Math.min(100, parseInt(qs.get("discount") || "0", 10) || 0)), all = [];
    $("#kk-q").value = q; g.innerHTML = '<p class="kk-msg">Loading toys&hellip;</p>';
    var requestedType = qs.get("type") || "";
    var ageLabels = {"0-3-months":"0–3 Months","3-6-months":"3–6 Months","6-9-months":"6–9 Months","9-12-months":"9–12 Months","1-2-years":"1–2 Years","2-4-years":"2–4 Years","4-6-years":"4–6 Years","6-8-years":"6–8 Years","8-10-years":"8–10 Years","10-12-years":"10–12 Years","12-years":"12 Years & Over","0-18-months":"0–18 Months","18-36-months":"18–36 Months","3-5-years":"3–5 Years","7-9-years":"7–9 Years","9-12-years":"9–12 Years","12-plus-years":"12+ Years"};
    var categoryLabel = qs.get("category") || requestedType || (age ? "Toys for " + (ageLabels[age] || age.replace(/-/g, " ")) : "") || (vendor ? qs.get("vendor") : "") || (maxPrice ? "Under ₹" + maxPrice : "") || (favourite ? "Favourite Toys" : "");
    if (!categoryLabel && minDiscount) categoryLabel = minDiscount + "% OFF Toys";
    if (!categoryLabel && q) categoryLabel = 'Search results for “' + q + '”';
    var pageHeading = $(".kk-main h1");
    if (pageHeading && categoryLabel) { pageHeading.textContent = categoryLabel; document.title = categoryLabel + " | KhelKhilone"; }
    function clean(v) { return String(v || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim(); }
    function categoryMatches(p) {
      if (!category) return true;
      var wanted = clean(category);
      var col = (p.collections || []).some(function (c) { return clean(c.title) === wanted || clean(c.handle) === wanted || clean(c.title).indexOf(wanted) !== -1 || clean(c.handle).indexOf(wanted) !== -1; });
      if (col) return true;
      var type = clean(p.type), title = clean(p.title), tags = (p.tags || []).map(clean), handle = clean(p.handle);
      // Prefer explicit Shopify category metadata. Use product title/tags as a fallback for stores
      // that have not yet assigned the product to a matching collection.
      if (type === wanted || title.indexOf(wanted) !== -1 || handle.indexOf(wanted) !== -1 || tags.some(function (t) { return t === wanted || t.indexOf(wanted) !== -1; })) return true;
      var words = wanted.split(/\s+/).filter(function (w) { return w.length > 2 && !/^(new|toys|toy|sets|kids|and|the|for)$/.test(w); });
      return words.length > 0 && (type === wanted || tags.some(function (t) { return words.every(function (w) { return t.indexOf(w) !== -1; }); }));
    }
    function ageMatches(p, ageKey) {
      var hay = [p.title, p.type, p.handle, (p.tags || []).join(" "), (p.collections || []).map(function(c){return c.title || c.handle || "";}).join(" ")].join(" ").toLowerCase().replace(/[^a-z0-9]+/g," ");
      var ranges = {"0-3-months":["0 3 months","0 3 month","newborn"],"3-6-months":["3 6 months","3 6 month"],"6-9-months":["6 9 months","6 9 month"],"9-12-months":["9 12 months","9 12 month"],"1-2-years":["1 2 years","1 2 year","toddler"],"2-4-years":["2 4 years","2 4 year","toddler","preschool"],"4-6-years":["4 6 years","4 6 year","preschool"],"6-8-years":["6 8 years","6 8 year"],"8-10-years":["8 10 years","8 10 year"],"10-12-years":["10 12 years","10 12 year"],"12-years":["12 years","12 plus years","teen"],"0-18-months":["0 18 months","0 18 month","newborn","baby"],"18-36-months":["18 36 months","18 36 month","toddler"],"3-5-years":["3 5 years","3 5 year","preschool"],"7-9-years":["7 9 years","7 9 year"],"9-12-years":["9 12 years","9 12 year"],"12-plus-years":["12 plus years","12 years","teen"]};
      return (ranges[ageKey] || [ageKey.replace(/-/g," ")]).some(function(term){return hay.indexOf(term) !== -1;});
    }
    function draw() {
      var t = $("#kk-type").value, s = $("#kk-sort").value;
      var eligible = all.filter(function (p) { return !age || ageMatches(p, age); });
      /* If the catalog has no explicit age labels yet, keep the age-card destination useful by showing the products instead of an empty page. */
      var ageHasMatches = !age || eligible.length > 0;
      var a = all.filter(function (p) {
        var off = p.compare > p.price ? Math.round(100 - p.price / p.compare * 100) : 0;
        return (!t || p.type === t) && categoryMatches(p) && (!age || !ageHasMatches || ageMatches(p, age)) && (!vendor || (p.vendor || "").toLowerCase() === vendor) && (!maxPrice || p.price < maxPrice) && (!minDiscount || off >= minDiscount);
      });
      if (favourite) a.sort(function(x,y){ return (y.available?1:0)-(x.available?1:0); });
      if (s === "pl") a.sort(function (x, y) { return x.price - y.price; });
      if (s === "ph") a.sort(function (x, y) { return y.price - x.price; });
      if (s === "az") a.sort(function (x, y) { return x.title.localeCompare(y.title); });
      $("#kk-count").textContent = a.length + " product" + (a.length === 1 ? "" : "s") + (minDiscount ? " matching " + minDiscount + "% OFF or more" : "");
      g.innerHTML = a.length ? a.map(card).join("") : '<div class="kk-msg kk-empty-category"><h2>Products not listed yet</h2><p>There are currently no Shopify products listed in this category. Add a product in Shopify and assign it to the matching collection or category to show it here automatically.</p><a class="kk-btn" href="/shop.html">Browse all products</a></div>';
    }
    listProducts(q).then(function (a) {
      all = a;
      var types = a.map(function (p) { return p.type; }).filter(function (v, i, r) { return v && r.indexOf(v) === i; }).sort();
      $("#kk-type").innerHTML = '<option value="">All categories</option>' + types.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join("");
      if (requestedType && types.indexOf(requestedType) !== -1) $("#kk-type").value = requestedType;
      draw();
    }).catch(function (e) { fail(g, e); });
    ["kk-type", "kk-sort"].forEach(function (i) { $("#" + i).addEventListener("change", draw); });
  }
  function productPage() {
    var root = $("#kk-product"), h = decodeURIComponent((location.pathname.split("/").filter(Boolean).pop() || "").replace(".html", "")); if (h === "product") h = new URLSearchParams(location.search).get("handle") || "";
    root.innerHTML = '<p class="kk-msg">Loading&hellip;</p>';
    getProduct(h).then(function (p) {
      if (!p) { root.innerHTML = LIVE ? '<p class="kk-msg">Product not found. <a href="/shop.html">Browse all products</a></p>' : '<p class="kk-msg">Shopify is not connected yet. Add your store domain and Storefront API token in <code>public/js/config.js</code> to load real products.</p>'; return; }
      document.title = p.title + " | KhelKhilone"; var md = $('meta[name="description"]'); if (md) md.content = (p.desc || "").replace(/<[^>]+>/g, "").slice(0, 150) || p.title;
      var imgs = p.images.length ? p.images : [p.image], multi = p.variants.length > 1, cur = p.variants[0];
      root.innerHTML = '<div class="kk-gal"><img id="kk-main" src="' + esc(imgs[0]) + '" alt="' + esc(p.title) + '"><div class="kk-thumbs">' + (imgs.length > 1 ? imgs.map(function (u) { return '<img src="' + esc(u) + '" alt="" tabindex="0">'; }).join("") : "") + '</div></div>' +
        '<div class="kk-info"><small>' + esc(p.type) + '</small><h1>' + esc(p.title) + '</h1><div class="kk-pr big" id="kk-price"></div>' +
        (multi ? '<label>Option<select id="kk-var">' + p.variants.map(function (v, i) { return '<option value="' + i + '"' + (v.available ? "" : " disabled") + '>' + esc(v.title) + (v.available ? "" : " (sold out)") + '</option>'; }).join("") + '</select></label>' : "") +
        '<label>Quantity<input id="kk-qty" type="number" min="1" max="20" value="1"></label><button id="kk-addbtn" class="kk-btn kk-full">Add to cart</button><button id="kk-buy" class="kk-btn alt kk-full">Buy now</button>' +
        '<ul class="kk-perks"><li>Free delivery above ' + inr(C.freeShipFrom || 999) + '</li><li>Warranty &amp; reliable service from our Akola store</li><li>Questions? Call ' + esc(C.phone) + '</li></ul><div class="kk-desc">' + p.desc + '</div></div>';
      function price() { var off = cur.compare > cur.price; $("#kk-price").innerHTML = '<b>' + inr(cur.price) + '</b>' + (off ? '<s>' + inr(cur.compare) + '</s><span class="kk-off">OFF ' + Math.round(100 - cur.price / cur.compare * 100) + '%</span>' : ""); $("#kk-addbtn").disabled = $("#kk-buy").disabled = !cur.available; if (!cur.available) $("#kk-addbtn").textContent = "Sold out"; else $("#kk-addbtn").textContent = "Add to cart"; }
      price();
      var vs = $("#kk-var"); if (vs) vs.addEventListener("change", function () { cur = p.variants[+vs.value]; price(); });
      $$(".kk-thumbs img").forEach(function (t) { var go = function () { $("#kk-main").src = t.src; }; t.addEventListener("click", go); t.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); }); });
      var qty = function () { return Math.max(1, Math.min(20, parseInt($("#kk-qty").value, 10) || 1)); };
      $("#kk-addbtn").addEventListener("click", function () { addToCart(p, cur.id, qty()); });
      $("#kk-buy").addEventListener("click", function () { addToCart(p, cur.id, qty()).then(function () { if (LIVE && cart.checkoutUrl) location.href = cart.checkoutUrl; }); });
      listProducts(LIVE && p.type ? 'product_type:"' + p.type.replace(/"/g, "") + '"' : "").then(function (a) { a = a.filter(function (x) { return x.handle !== p.handle && (LIVE || x.type === p.type || true); }).slice(0, 4);
        if (a.length) $("#kk-related").innerHTML = "<h2>You may also like</h2><div class='kk-grid'>" + a.map(card).join("") + "</div>"; }).catch(function () {});
    }).catch(function (e) { fail(root, e); });
  }
  function homePage() {
    var cb = $('a.top-cart[title="Cart View"]'); if (cb) { cb.insertAdjacentHTML("beforeend", '<span class="kk-count" style="display:none">0</span>'); cb.addEventListener("click", function (e) { e.preventDefault(); openDrawer(); }); }
    var ft = $(".footer1") || $("footer"); if (ft && !$("#contact")) ft.id = "contact";
    // Remove the expired weekly-deals section entirely (including its heading and demo cards).
    var deals = $("#our-deals"); if (deals) deals.remove();
    $$(["section", ".elementor-section", ".vc_section", ".container-fluid"].join(",")).forEach(function (el) {
      var h = $("h1,h2,h3,h4", el);
      if (h && /unmissable weekly deals|timer up|event expired/i.test(el.innerText || el.textContent || "")) el.remove();
    });
    var m = $("#menu-item-27 > a"); if (m) m.href = "/shop"; m = $("#menu-item-26 > a"); if (m) m.href = "/";
    $$("a.wishlist_view").forEach(function (a) { a.href = "/shop"; });
    var acc = $(".header-admin-icon a"); if (acc) { acc.href = LIVE ? "https://" + C.shop + "/account" : "/shop"; }
    $$("form.woocommerce-product-search").forEach(function (f) { f.addEventListener("submit", function (e) { e.preventDefault(); var i = $("input[type=search],input[name=s]", f); location.href = "/shop" + (i && i.value ? "?q=" + encodeURIComponent(i.value) : ""); }); });
    $$("a[href]").forEach(function (a) { if (/blog/i.test(a.textContent) && a.getAttribute("href") === "#") a.href = "/shop"; });
    // Hide every template product immediately. Only reveal cards after Shopify returns real products.
    var homeProductCards = $$(".product-box");
    homeProductCards.forEach(function (b) { b.style.display = "none"; });
    function clearHomeProductCards() {
      $$(".product-box").forEach(function (b) { b.remove(); });
      $$(".products-content-outer-box").forEach(function (wrap) {
        if (!wrap.querySelector(".product-box")) wrap.remove();
      });
    }
    // Remove any stale cart from the former demo mode; Shopify cart is authoritative.
    ls.del("kk_demo_cart");
    listProducts("").then(function (a) {
      // Restore the complete category directory even when the Shopify catalog is empty or temporarily unavailable.
      (function renderShopCategories() {
        var section = $("#shop-by-category");
        if (!section) return;
        var heading = $(".shop-category-heading", section);
        if (heading) heading.innerHTML = '<h5>Find the Perfect Toy for Every Stage!</h5><h2>Shop by Category</h2>';
        var groups = [
          ["SHOP BY CATEGORY", ["Musical Toys","Learning & Educational Toys","Soft Toys","Indoor & Outdoor Play","Play Gyms & Playmats","Sports & Games","Role & Pretend Play Toys","Blocks & Construction Sets","Stacking Toys","Kids Puzzles","Baby Rattles","Toys Cars Trains & Vehicles","Kids Musical Instruments","Dolls & Dollhouses","Push & Pull Along Toys","Art Crafts & Hobby Kits","Board Games","Novelty Toys NEW","Magnetic Toys NEW","Action Figures & Collectibles","Radio & Remote Control Toys","Bath Toys","Toys Guns & Weapons","PC Games & Gaming Consoles","Kids Gadgets NEW"]],
          ["RIDE-ONS & SCOOTERS", ["Battery Operated Ride-ons","Manual Push Ride-ons","Swing cars/twisters","Scooters","Rocking Ride Ons","Tricycles","Bicycles","Balance Bike"]],
          ["COMBO PACKS", ["Combo Packs"]],
          ["BOARD GAMES", ["IQ Games","Ludo, Snakes & Ladders","Words, Pictures & Scrabble Games","Playing Cards","Life & Travel Board Games","Animal, Birds & Marine Life Games","Business/Monopoly"]],
          ["HOME PLAY ACTIVITIES", ["Play Dough, Sand & Moulds","Coloring, Sequencing & Engraving Art","Activity Kit","Building Construction Sets","Multi Model Making Sets","Kitchen Sets","Play Foods","Kids' Doctor Sets","Piano & Keyboards","Drum Sets & Percussion"]],
          ["SHOP BY BRANDS", ["Babyhug","Intelliskills","Intellibaby","Fab n Funky","Hotwheels","Disney","Barbie","Giggles","Lego","Bonfino","Pine Kids","Playnation","Doodle Poodle"]],
          ["SHOP BY PRICE", ["Under 299","Under 499","Under 699","Under 999","Favourite Toys"]]
        ];
        var images = ["/img/cat1.png","/img/cat2.png","/img/cat3.png","/img/cat4.png","/img/cat5.png","/img/cat6.png"];
        var carousel = $(".owl-carousel", section);
        if (!carousel) return;
        carousel.className = "kk-category-directory";
        carousel.innerHTML = groups.map(function(group, gi) {
          // Keep the category tiles and group layout, but omit only these four heading labels
          // in the homepage Shop by Category section. The links below each heading stay visible.
          var hiddenHomeCategoryHeadings = ["RIDE-ONS & SCOOTERS", "COMBO PACKS", "BOARD GAMES", "HOME PLAY ACTIVITIES"];
          var groupHeading = hiddenHomeCategoryHeadings.indexOf(String(group[0]).toUpperCase()) !== -1
            ? ""
            : '<h3>' + esc(group[0]) + '</h3>';
          return '<div class="kk-category-group">' + groupHeading + '<div class="kk-category-links">' +
            group[1].map(function(label, i) {
              var price = /^Under /.test(label), brand = gi === 5, fav = label === "Favourite Toys";
              var href = price ? '/shop?max=' + encodeURIComponent(label.replace(/[^0-9]/g,'')) :
                (brand ? '/shop?vendor=' + encodeURIComponent(label) : (fav ? '/shop?sort=favourite' : '/shop?category=' + encodeURIComponent(label)));
              return '<a class="kk-category-tile" href="' + href + '"><img src="' + images[(i+gi)%images.length] + '" alt="" loading="lazy"><span>' + esc(label) + '</span></a>';
            }).join("") + '</div></div>';
        }).join("");
        // Final safety pass: remove ONLY the four requested group heading labels
        // inside the homepage Shop by Category section, including any stale headings
        // left by older cached/editor markup. Keep all category tiles and links.
        var headingsToHide = ["RIDE-ONS & SCOOTERS", "COMBO PACKS", "BOARD GAMES", "HOME PLAY ACTIVITIES"];
        section.querySelectorAll("h1,h2,h3,h4,h5,h6,p,div,span").forEach(function (node) {
          if (node.children.length === 0 && headingsToHide.indexOf(String(node.textContent || "").trim().toUpperCase()) !== -1) {
            node.remove();
          }
        });
      })();
      if (!a.length) { clearHomeProductCards(); return; }
      $$(".product-box").forEach(function (b, i) {
        var p = a[i];
        if (!p) { b.remove(); return; } // never repeat fake/template cards when Shopify has fewer products
        var img = $("img", b), t = $(".inner-page-name-link", b), c = $(".cat-title a", b);
        if (!img || !t) { b.remove(); return; }
        img.src = p.image; img.removeAttribute("srcset"); img.alt = p.title; t.textContent = p.title; if (c) c.textContent = p.type;
        var r = $(".product-regular-price", b), s = $(".product-sale-price s", b), d = $(".product-discount", b);
        if (r) r.textContent = inr(p.price);
        if (p.compare > p.price) { if (s) s.textContent = inr(p.compare); if (d) { d.style.display = ""; var dp = $("p", d); if (dp) dp.textContent = "OFF " + Math.round(100 - p.price / p.compare * 100) + "%"; } }
        else { if (s) s.textContent = ""; if (d) d.style.display = "none"; }
        $$("a", b).forEach(function (l) { if (!l.closest(".product-plus-icon")) l.href = "/product.html?handle=" + encodeURIComponent(p.handle); });
        // Make the whole homepage product tile open the Shopify product details page.
        b.style.cursor = "pointer"; b.setAttribute("role", "link"); b.setAttribute("tabindex", "0");
        if (!b.dataset.kkProductNavigation) {
          b.dataset.kkProductNavigation = "1";
          var openProduct = function (e) { if (e.target.closest("a,button,input,select,.product-plus-icon")) return; location.href = "/product.html?handle=" + encodeURIComponent(p.handle); };
          b.addEventListener("click", openProduct);
          b.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && !e.target.closest("a,button,input,select,.product-plus-icon")) { e.preventDefault(); location.href = "/product.html?handle=" + encodeURIComponent(p.handle); } });
        }
        var plus = $(".product-plus-icon a", b); if (plus) { plus.href = "/product.html?handle=" + encodeURIComponent(p.handle); plus.setAttribute("aria-label", "Add " + p.title + " to cart"); plus.addEventListener("click", function (e) { e.preventDefault(); addToCart(p, p.variantId, 1); }); }
        b.style.display = "";
      });
    }).catch(function () { clearHomeProductCards(); });
    var nf = $$("form").filter(function (f) { return $("input[type=email]", f) || /mail here/i.test((($("input", f) || {}).placeholder) || ""); })[0];
    if (nf) { nf.setAttribute("name", "newsletter"); nf.addEventListener("submit", function (e) { e.preventDefault(); var i = $("input", nf), v = (i.value || "").trim();
      if (!/^\S+@\S+\.\S+$/.test(v)) return toast("Please enter a valid email address", 1);
      fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "form-name=newsletter&email=" + encodeURIComponent(v) }).then(function (r) { if (!r.ok) throw 0; i.value = ""; toast("Thanks for subscribing!"); }).catch(function () { toast("Could not subscribe, please try again", 1); }); }); }
  }

  /* ---------- boot ---------- */
  document.addEventListener("click", function (e) { var b = e.target.closest(".kk-add"); if (b) { e.preventDefault(); var p = byHandle[b.dataset.h]; if (p) addToCart(p); } var c = e.target.closest(".kk-cartbtn"); if (c) openDrawer(); });
  function boot() {
    if (P !== "home") chrome();
    buildDrawer(); loadCart();
    if (P === "shop") shopPage(); else if (P === "product") productPage(); else if (P === "home") homePage();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();

/* Persistent homepage-only removal of four category group heading labels.
   Runs independently of Shopify fetches and editor/layout hydration; category tiles remain untouched. */
(function () {
  var targets = new Set(["RIDE-ONS & SCOOTERS", "COMBO PACKS", "BOARD GAMES", "HOME PLAY ACTIVITIES"]);
  function cleanHomepageCategoryHeadings() {
    var section = document.querySelector("#shop-by-category");
    if (!section) return;
    section.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach(function (heading) {
      var label = String(heading.textContent || "").replace(/\\s+/g, " ").trim().toUpperCase();
      if (targets.has(label)) heading.remove();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", cleanHomepageCategoryHeadings);
  else cleanHomepageCategoryHeadings();
  if (typeof MutationObserver !== "undefined" && document.documentElement) {
    new MutationObserver(cleanHomepageCategoryHeadings).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
