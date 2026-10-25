/* KhelKhilone – Shopify connection. Set the permanent Shopify domain before deployment.
   1) Shopify admin → Settings → Apps and sales channels → Develop apps → create app
      → enable Storefront API (unauthenticated_read_product_listings, unauthenticated_read_product_inventory,
      unauthenticated_write_checkouts, unauthenticated_read_checkouts, unauthenticated_write_customers) → Install
      → copy the "Storefront API access token" (this token is public by design).
   2) Fill the two values below and redeploy. Leave empty to show an empty catalog until Shopify is connected; no demo products are loaded. */
window.KK = {
  shop: "nhvj5h-ar.myshopify.com", // Connected Shopify store permanent domain
  token: "3b1e76c2cb40be26ddf9eb0da4f74e42",           // Public Storefront API token; safe for browser use
  freeShipFrom: 299,   // free delivery above (INR)
  phone: "+91 94201 01924",
  address: "Mahatma Gandhi Rd, opp. Mahanagar Palika, Kala Chabutra, Baid Pura, Akola, Maharashtra 444001",
  maps: "https://www.google.com/maps/search/?api=1&query=Khel+Khilone+Akola",
  reviews: "https://www.google.com/search?q=khelkhilone+akola"
};
