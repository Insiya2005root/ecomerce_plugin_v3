/**
 * Comprehensive Official Documentation Generator for OpenExt E-Commerce Plugin
 * Generates an executive-grade Word (.docx) document with Table of Contents,
 * complete module specifications, UI locations, and full database schemas.
 */

const fs = require('fs');
const path = require('path');
const docx = require('C:/Users/InsiyaMerchant/Projects/ecommerce-plugin-dev/web/node_modules/docx');

const {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  Packer,
} = docx;

// ----------------------------------------------------
// STYLING CONSTANTS (Executive Navy Palette)
// ----------------------------------------------------
const COLOR_PRIMARY = '1E3A8A';    // Deep Navy
const COLOR_SECONDARY = '2563EB';  // Royal Blue
const COLOR_TEXT = '0F172A';       // Slate 900
const COLOR_MUTED = '475569';      // Slate 600
const COLOR_LIGHT_BG = 'F8FAFC';   // Slate 50
const COLOR_HEADER_BG = '1E293B';  // Slate 800
const COLOR_BORDER = 'CBD5E1';     // Slate 300
const FONT_FAMILY = 'Calibri';

function createHeading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 32, // 16pt
        color: COLOR_PRIMARY,
        font: FONT_FAMILY,
      }),
    ],
  });
}

function createHeading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 26, // 13pt
        color: COLOR_SECONDARY,
        font: FONT_FAMILY,
      }),
    ],
  });
}

function createHeading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 60 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 22, // 11pt
        color: COLOR_TEXT,
        font: FONT_FAMILY,
      }),
    ],
  });
}

function createParagraph(text, options = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 276 }, // 1.15 line spacing
    children: [
      new TextRun({
        text,
        size: 21, // 10.5pt
        color: options.color || COLOR_TEXT,
        font: FONT_FAMILY,
        bold: options.bold || false,
        italics: options.italics || false,
      }),
    ],
  });
}

function createBullet(text, boldPrefix = '') {
  const children = [];
  if (boldPrefix) {
    children.push(
      new TextRun({
        text: boldPrefix,
        bold: true,
        size: 21,
        color: COLOR_TEXT,
        font: FONT_FAMILY,
      })
    );
  }
  children.push(
    new TextRun({
      text,
      size: 21,
      color: COLOR_TEXT,
      font: FONT_FAMILY,
    })
  );
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 40, line: 260 },
    children,
  });
}

function createCallout(title, body) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      left: { style: BorderStyle.SINGLE, size: 24, color: COLOR_PRIMARY },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: 'EFF6FF' }, // Light Blue Tint
            margins: { top: 120, bottom: 120, left: 180, right: 180 },
            children: [
              new Paragraph({
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: title,
                    bold: true,
                    size: 21,
                    color: COLOR_PRIMARY,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: body,
                    size: 20,
                    color: COLOR_TEXT,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function createTable(headers, rows, colWidths = []) {
  const borderStyle = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
  const borders = {
    top: borderStyle,
    bottom: borderStyle,
    left: borderStyle,
    right: borderStyle,
    insideHorizontal: borderStyle,
    insideVertical: borderStyle,
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      new TableCell({
        width: colWidths[i] ? { size: colWidths[i], type: WidthType.PERCENTAGE } : undefined,
        shading: { type: ShadingType.CLEAR, fill: COLOR_HEADER_BG },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: h,
                bold: true,
                size: 20,
                color: 'FFFFFF',
                font: FONT_FAMILY,
              }),
            ],
          }),
        ],
      })
    ),
  });

  const tableRows = rows.map(
    (row, rIdx) =>
      new TableRow({
        children: row.map((cellText, i) =>
          new TableCell({
            width: colWidths[i] ? { size: colWidths[i], type: WidthType.PERCENTAGE } : undefined,
            shading: {
              type: ShadingType.CLEAR,
              fill: rIdx % 2 === 0 ? 'FFFFFF' : COLOR_LIGHT_BG,
            },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cellText,
                    size: 19,
                    color: COLOR_TEXT,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          })
        ),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows: [headerRow, ...tableRows],
  });
}

// ----------------------------------------------------
// DOCUMENT BUILDER
// ----------------------------------------------------
async function generateDoc() {
  console.log('Building comprehensive official document for OpenExt Ecommerce Plugin...');

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT_FAMILY,
            color: COLOR_TEXT,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 1 inch margins
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'OpenExt E-Commerce Plugin — Official Architecture & Module Specification',
                    size: 16,
                    color: COLOR_MUTED,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Page ',
                    size: 16,
                    color: COLOR_MUTED,
                    font: FONT_FAMILY,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: COLOR_MUTED,
                    font: FONT_FAMILY,
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    color: COLOR_MUTED,
                    font: FONT_FAMILY,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: COLOR_MUTED,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // ----------------------------------------------------
          // TITLE & COVER BLOCK
          // ----------------------------------------------------
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({
                text: 'OPENEXT E-COMMERCE PLUGIN',
                bold: true,
                size: 44, // 22pt
                color: COLOR_PRIMARY,
                font: FONT_FAMILY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 240 },
            children: [
              new TextRun({
                text: 'Official Architecture, Complete Module Feature Specification & Database Design',
                size: 26,
                color: COLOR_SECONDARY,
                font: FONT_FAMILY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 360 },
            children: [
              new TextRun({
                text: 'Version 1.0.0 (Storefront M1–M5 Hardened) | OpenExt Headless CMS Host',
                size: 20,
                color: COLOR_MUTED,
                italics: true,
                font: FONT_FAMILY,
              }),
            ],
          }),

          createCallout(
            'EXECUTIVE SPECIFICATION & ARCHITECTURAL SUMMARY',
            'This official document provides the authoritative architectural and functional reference for the OpenExt E-Commerce Plugin (ID: ecommerce-plugin). It details the Three-Tier OpenExt execution model, inventories every functional module with its UI display locations and API endpoints, and provides the complete database design including schemas, data types, indexes, and live MongoDB collection metrics.'
          ),

          new Paragraph({ spacing: { before: 240 } }),

          // ----------------------------------------------------
          // TABLE OF CONTENTS (INDEX)
          // ----------------------------------------------------
          createHeading1('Table of Contents (Index)'),
          createParagraph('1.0 Architecture & OpenExt Host Integration'),
          createParagraph('    1.1 The Three-Tier Plugin Architecture'),
          createParagraph('    1.2 OpenExt Plugin Lifecycle & Upload Contract'),
          createParagraph('    1.3 Tenant Security & Multitenancy Strategy'),
          createParagraph('2.0 Module Specifications: Features, Logic & UI Display Locations'),
          createParagraph('    2.1 Module 1: Dashboard Module'),
          createParagraph('    2.2 Module 2: Products Module'),
          createParagraph('    2.3 Module 3: Categories Module'),
          createParagraph('    2.4 Module 4: Orders & Fulfillment Module'),
          createParagraph('    2.5 Module 5: Discounts & Promotions Module'),
          createParagraph('    2.6 Module 6: Cart Simulator & Calculation Engine'),
          createParagraph('    2.7 Module 7: Settings Module (Store, Taxes, Shipping, Locations)'),
          createParagraph('    2.8 Module 8: Storefront Module (Blueprint System & Pages)'),
          createParagraph('    2.9 Module 9: Customer-Facing Storefront Engine & Blocks'),
          createParagraph('3.0 Comprehensive Database Design & Schema Dictionary'),
          createParagraph('    3.1 Live Database Collections & Volume Summary'),
          createParagraph('    3.2 Collection 1: ecommerce-plugin_products'),
          createParagraph('    3.3 Collection 2: ecommerce-plugin_categories'),
          createParagraph('    3.4 Collection 3: ecommerce-plugin_ecommerceorders'),
          createParagraph('    3.5 Collection 4: ecommerce-plugin_ecommercediscountrules'),
          createParagraph('    3.6 Collection 5: ecommerce-plugin_ecommercestorefrontpages'),
          createParagraph('    3.7 Collection 6: ecommerce-plugin_ecommercesettings'),
          createParagraph('    3.8 Collection 7: ecommerce-plugin_ecommercetaxclasses'),
          createParagraph('    3.9 Collection 8: ecommerce-plugin_ecommercetaxrules'),
          createParagraph('    3.10 Collection 9: ecommerce-plugin_ecommercelocations'),
          createParagraph('    3.11 Collection 10: ecommerce-plugin_ecommercecollections'),
          createParagraph('    3.12 Collection 11: ecommerce-plugin_ecommerceadminprofiles'),
          createParagraph('4.0 Entity-Relationship Matrix & Cross-Collection Dependencies'),
          createParagraph('5.0 Plugin Packaging & Build Pipeline Reference'),

          new Paragraph({ spacing: { before: 240 } }),

          // ----------------------------------------------------
          // SECTION 1.0: ARCHITECTURE & OPENEXT INTEGRATION
          // ----------------------------------------------------
          createHeading1('1.0 Architecture & OpenExt Host Integration'),
          createParagraph(
            'The E-Commerce Plugin is architectured as a single cohesive plugin designed for the OpenExt Headless CMS platform. It eliminates the need for separate standalone applications or secondary backend servers by providing a unified repository with three distinct execution tiers.'
          ),

          createHeading2('1.1 The Three-Tier Plugin Architecture'),
          createBullet(
            'Runs inside OpenExt’s Node.js/Express host runtime. Bootstrapped by api/index.js as declared in manifest.json. Responsible for registering Mongoose models in MongoDB, mounting public customer-facing routes (/storefront/*), mounting protected administrative endpoints, and executing business logic engines (DiscountEngine, TaxEngine, ShippingService).',
            '1. Backend Server Tier (api/): '
          ),
          createBullet(
            'Pre-compiled static single-page application exported from Next.js 15 (web/out) into ui/admin/. Rendered seamlessly inside the OpenExt Admin Panel shell when a merchant accesses the commerce administration navigation items.',
            '2. Admin UI Tier (ui/admin/): '
          ),
          createBullet(
            'A standalone, self-contained JavaScript bundle (ui/block/index.js) and stylesheet (ui/block/styles.css) compiled via esbuild. Dynamically mounted into published customer-facing CMS pages by OpenExt’s page renderer via window.__NEXTCMS_PLUGINS__["ecommerce-plugin"].mount().',
            '3. Storefront Block Tier (ui/block/): '
          ),

          createHeading2('1.2 OpenExt Plugin Lifecycle & Upload Contract'),
          createParagraph(
            'When the packaged archive (ecommerce-plugin.zip) is uploaded through the OpenExt Plugin Manager interface, the host executes a strict validation and registration sequence:'
          ),
          createBullet(
            'Verifies manifest.json exists at root, checks permissions (ecommerce.read, ecommerce.write, ecommerce.configure), enforces package limit (< 1,000 files) and size (< 50MB).',
            'Step 1 - Package Validation: '
          ),
          createBullet(
            'Loads api/index.js into the host Express server, registers models under the CMS database namespace, and exposes API endpoints.',
            'Step 2 - Server Bootstrapping: '
          ),
          createBullet(
            'Reads manifest.json adminNav entries (Dashboard, Products, Categories, Orders, Discounts, Cart, Settings, Storefront) and injects links into the CMS sidebar navigation.',
            'Step 3 - Admin Nav Registration: '
          ),
          createBullet(
            'When a customer navigates to a published storefront route (e.g., /shop), OpenExt CMS dynamically loads ui/block/index.js, which self-injects its scoped stylesheet into document.head and mounts the React block renderer.',
            'Step 4 - Storefront Mounting: '
          ),

          createHeading2('1.3 Tenant Security & Multitenancy Strategy'),
          createParagraph(
            'To guarantee strict multitenancy and prevent cross-tenant data leakage, the plugin implements trusted server-assigned tenant resolution across every endpoint. Unauthenticated client headers (x-tenant-id, tenant-id) and request query/body parameters are strictly ignored. The resolution inspects server-validated properties (req.tenantId, req.tenant?.id, req.cms?.tenantId, req.user?.tenantId, req.storeId) and falls back safely to default_tenant only when single-tenant operation is active.'
          ),

          new Paragraph({ spacing: { before: 240 } }),

          // ----------------------------------------------------
          // SECTION 2.0: MODULE SPECIFICATIONS
          // ----------------------------------------------------
          createHeading1('2.0 Module Specifications: Features, Logic & UI Display Locations'),
          createParagraph(
            'This section provides an exhaustive walkthrough of all 9 modules included in the plugin. For each module, all functional capabilities are itemized alongside the exact UI page, modal, or customer-facing component where they are displayed.'
          ),

          // MODULE 1: DASHBOARD
          createHeading2('2.1 Module 1: Dashboard Module'),
          createParagraph(
            'The Commerce Dashboard serves as the command center for store merchants, offering real-time financial metrics, recent transaction feeds, inventory alerts, and quick administrative shortcuts.'
          ),
          createTable(
            ['Feature Name', 'Functionality Description', 'UI Display Location', 'API Endpoint'],
            [
              [
                'Financial KPI Metrics',
                'Aggregates Total Revenue, Total Order Count, Average Order Value (AOV), and Pending Orders count with trend indicators.',
                'Top metric cards on Admin Dashboard (ui/admin/index.html)',
                'GET /orders, GET /products',
              ],
              [
                'Sales Performance Chart',
                'Visualizes sales volume and revenue over selectable timeframes (7 days, 30 days, 90 days, or 12 months).',
                'Center analytical chart on Admin Dashboard',
                'GET /orders (pricing aggregation)',
              ],
              [
                'Recent Orders Feed',
                'Tabular list of the latest 5–10 customer orders showing Order ID, Customer, Date, Payment Status, and Total.',
                'Lower-left table on Admin Dashboard',
                'GET /orders?limit=10',
              ],
              [
                'Low Stock Inventory Alert',
                'Real-time warning list identifying products whose stock count is at or below the configured low stock threshold.',
                'Right-hand alert widget on Admin Dashboard',
                'GET /products?stock_lte=threshold',
              ],
              [
                'Quick Action Shortcuts',
                'One-click navigational buttons to Add New Product, Create Discount Coupon, or Configure Shipping.',
                'Header action toolbar on Admin Dashboard',
                'Client-side router links',
              ],
            ],
            [22, 38, 25, 15]
          ),

          new Paragraph({ spacing: { before: 180 } }),

          // MODULE 2: PRODUCTS
          createHeading2('2.2 Module 2: Products Module'),
          createParagraph(
            'The Products module provides end-to-end catalog management supporting simple products, multi-attribute variants, promotional pricing, media galleries, inventory tracking, and customer-facing catalog presentation.'
          ),
          createTable(
            ['Feature Name', 'Functionality Description', 'UI Display Location', 'API Endpoint'],
            [
              [
                'Catalog List & Filters',
                'Full paginated product table with live keyword search, category filter, status filter (Published/Draft/Archived), and stock status.',
                'Admin Products Page (ui/admin/products/index.html)',
                'GET /products',
              ],
              [
                'Product Creation & Editing',
                'Multi-section editor capturing Product Name, Description, Rich Text, Slug (auto-generated or custom), and Visibility Status.',
                'Admin Add/Edit (ui/admin/products/add/index.html, edit/index.html)',
                'POST /products, PUT /products/:id',
              ],
              [
                'Pricing & Margin Calculator',
                'Configures Base Selling Price, Promotional Discount Price, Discount Percentage (auto-synced), and Cost Price (for margin tracking).',
                'Pricing section on Add/Edit Product forms',
                'POST /products, PUT /products/:id',
              ],
              [
                'Inventory & SKU Automation',
                'Tracks Stock Quantity, Barcode, and unique SKU with automatic fallback generation (SKU-xxxxxx).',
                'Inventory section on Add/Edit Product forms',
                'POST /products, PUT /products/:id',
              ],
              [
                'Media Asset Gallery',
                'Uploads and manages primary product image, multiple gallery thumbnail images, and product video embed URLs.',
                'Media section on Add/Edit Product forms',
                'POST /products, PUT /products/:id',
              ],
              [
                'Multi-Attribute Variants',
                'Generates variant matrix supporting Size, Color, per-variant Stock, SKU, and optional Price Overrides.',
                'Variants accordion table on Add/Edit Product forms',
                'POST /products, PUT /products/:id',
              ],
              [
                'Tax & Product Classification',
                'Toggles taxable status, assigns Tax Class, sets Digital vs. Physical product flags, and tags.',
                'Organization sidebar on Add/Edit forms',
                'POST /products, PUT /products/:id',
              ],
              [
                'Search Engine Optimization (SEO)',
                'Custom Meta Title, Meta Description, and search keywords for customer-facing indexing.',
                'SEO Collapsible card on Add/Edit forms',
                'POST /products, PUT /products/:id',
              ],
              [
                'Customer ProductCard',
                'Reusable customer-facing card rendering 1:1 contained image, discount badge, 2-line title, price, and Add to Cart action.',
                'Storefront Product Grid (ui/block/index.js) & Admin Preview',
                'GET /storefront/products',
              ],
            ],
            [20, 40, 25, 15]
          ),

          new Paragraph({ spacing: { before: 180 } }),

          // MODULE 3: CATEGORIES
          createHeading2('2.3 Module 3: Categories Module'),
          createParagraph(
            'The Categories module structures catalog items into hierarchical trees, powering storefront filters, breadcrumbs, and targeted promotional campaigns.'
          ),
          createTable(
            ['Feature Name', 'Functionality Description', 'UI Display Location', 'API Endpoint'],
            [
              [
                'Category Tree Listing',
                'Visualizes all categories showing category banner image, name, slug, parent category, and total assigned products.',
                'Admin Categories Page (ui/admin/categories/index.html)',
                'GET /categories',
              ],
              [
                'Add / Edit Category',
                'Captures Name, Description, Banner/Thumbnail Image, Parent Category selector, Meta Title, and Meta Description.',
                'Admin Add/Edit (ui/admin/categories/add, edit)',
                'POST /categories, PUT /categories/:id',
              ],
              [
                'Automatic Slug Generation',
                'Derives URL-friendly unique slug from category name on save.',
                'Category edit forms & Storefront navigation',
                'Internal schema hook',
              ],
              [
                'Category Deletion Guard',
                'Validates and blocks category deletion if active products or child subcategories are linked.',
                'Confirmation dialog on Categories table',
                'DELETE /categories/:id',
              ],
              [
                'Storefront Category Pills',
                'Renders active customer-visible category list for one-click catalog filtering.',
                'Storefront Shop header & toolbar',
                'GET /storefront/categories',
              ],
            ],
            [22, 38, 25, 15]
          ),

          new Paragraph({ spacing: { before: 180 } }),

          // MODULE 4: ORDERS & FULFILLMENT
          createHeading2('2.4 Module 4: Orders & Fulfillment Module'),
          createParagraph(
            'The Orders module provides lifecycle processing for customer sales, tracking payment status, multi-stage fulfillment, courier tracking, refunds, and administrative notes.'
          ),
          createTable(
            ['Feature Name', 'Functionality Description', 'UI Display Location', 'API Endpoint'],
            [
              [
                'Orders Master Table',
                'Lists all transactions showing Order Number (ORD-xxxxxx), Customer Name, Email, Date, Payment Status, Fulfillment Status, and Total.',
                'Admin Orders Page (ui/admin/orders/index.html)',
                'GET /orders',
              ],
              [
                'Order Detail Inspector',
                'Slide-out drawer displaying customer details, shipping address, billing address, and itemized line items with unit prices and variants.',
                'Order Details Drawer on Orders Page',
                'GET /orders/:id',
              ],
              [
                'Pricing & Tax Breakdown',
                'Displays Subtotal, Item-level Discounts, Applied Coupons, Itemized Tax breakdown, Shipping fee, and Total Amount.',
                'Financial summary card in Order Drawer',
                'GET /orders/:id',
              ],
              [
                'Fulfillment Workflow',
                'Updates status (Not fulfilled -> Fulfilled -> Shipped -> Delivered) and records Carrier Name, Tracking Number, and timestamp.',
                'Fulfillment Action Modal in Order Drawer',
                'POST /orders/:id/fulfillment',
              ],
              [
                'Payment & Refund Manager',
                'Tracks payment status (Paid, Not paid, Refunded), payment reference, and records partial or full refunds with reason notes.',
                'Payment card & Refund modal in Order Drawer',
                'POST /orders/:id/refund',
              ],
              [
                'Order Audit Activity Log',
                'Immutable timeline of order events (Order Placed, Payment Captured, Shipped, Staff Note Added).',
                'Activity timeline in Order Drawer',
                'GET /orders/:id/events',
              ],
            ],
            [22, 38, 25, 15]
          ),

          new Paragraph({ spacing: { before: 180 } }),

          // MODULE 5: DISCOUNTS & PROMOTIONS
          createHeading2('2.5 Module 5: Discounts & Promotions Module'),
          createParagraph(
            'The Promotions module is powered by the core DiscountEngine, executing 7 discount types with support for stacking rules, exclusivity, customer limits, and scheduled campaign windows.'
          ),
          createTable(
            ['Promotion Type', 'Execution Logic & Parameters', 'UI Display Location', 'Engine Class / Route'],
            [
              [
                'Percentage Discount',
                'Applies X% discount across entire order subtotal or targeted product IDs. Supports minimum subtotal qualifiers.',
                'Discounts > All / Coupons (ui/admin/discounts/all)',
                'DiscountEngine (type: percentage)',
              ],
              [
                'Fixed Amount Discount',
                'Deducts a flat currency amount (e.g., $10 / ₹500 off) from the qualified subtotal.',
                'Discounts > All / Coupons (ui/admin/discounts/coupons)',
                'DiscountEngine (type: fixed_amount)',
              ],
              [
                'Buy X Get Y (BOGO)',
                'Buy quantity of product/category X to receive quantity of product Y free or at discounted rate. Supports repeat application.',
                'Discounts > Add BOGO Rule',
                'DiscountEngine (type: buy_x_get_y)',
              ],
              [
                'Free Gift with Purchase',
                'Automatically injects a specified free promotional product into the order when qualifying subtotal is met.',
                'Discounts > Free Gift Manager',
                'DiscountEngine (type: free_gift)',
              ],
              [
                'Spend X Get Y',
                'Unlocks rewards (Percentage, Fixed Amount, or Free Product) when customer spend exceeds defined threshold.',
                'Discounts > Spend & Save Manager',
                'DiscountEngine (type: spend_x_get_y)',
              ],
              [
                'Marketing Campaigns',
                'Parent marketing campaign grouping multiple child discount rules with storefront marketing headers.',
                'Discounts > Campaigns (ui/admin/discounts/campaigns)',
                'DiscountEngine (type: campaign)',
              ],
              [
                'Custom Rule Engine',
                'Advanced rules featuring priority ranking, stacking policies (allow vs. exclusive), condition trees, and action chains.',
                'Discounts > Custom Rules (ui/admin/discounts/custom)',
                'DiscountEngine (type: custom)',
              ],
              [
                'Usage Limits & Scheduling',
                'Enforces total redemption limits, per-customer limits, start date, and expiry date.',
                'Usage limits section on all discount forms',
                'POST /discounts, PUT /discounts/:id',
              ],
            ],
            [22, 38, 25, 15]
          ),

          new Paragraph({ spacing: { before: 180 } }),

          // MODULE 6: CART SIMULATOR
          createHeading2('2.6 Module 6: Cart Simulator & Calculation Engine'),
          createParagraph(
            'The Cart Simulator provides merchants and staff with a live interactive sandbox to test how complex products, variants, coupons, shipping rates, and taxes calculate in real time before publishing promotions.'
          ),
          createTable(
            ['Feature Name', 'Functionality Description', 'UI Display Location', 'API Endpoint'],
            [
              [
                'Interactive Product Picker',
                'Allows searching and adding live catalog products and selecting specific variants into the simulated cart.',
                'Left panel of Cart Simulator (ui/admin/cart/index.html)',
                'GET /products, GET /categories',
              ],
              [
                'Quantity & Line Adjustment',
                'Dynamically adjusts quantities, removes items, or tags items with free gift flags with instant recalculation.',
                'Cart line item table in Simulator',
                'Client-side state + POST /cart/calculate',
              ],
              [
                'Coupon Code Sandbox',
                'Applies promotional coupon codes to test validation, invalid code handling, and subtotal thresholds.',
                'Coupon input bar in Simulator',
                'POST /cart/calculate',
              ],
              [
                'Shipping Destination Tester',
                'Selects country, state, city, and postal code to simulate flat-rate vs. OSRM distance-based shipping fees.',
                'Shipping calculator widget in Simulator',
                'POST /cart/calculate',
              ],
              [
                'Financial Breakdown Inspector',
                'Displays itemized Subtotal, Applied Discounts list, Tax Breakdown by component, Shipping fee, and Total Amount.',
                'Right summary panel in Simulator',
                'POST /cart/calculate',
              ],
              [
                'Engine Trace Debugger',
                'Outputs step-by-step diagnostic trace logs showing which discount rules fired, which were excluded, and tax formulas used.',
                'Diagnostic log console at bottom of Simulator',
                'Internal calculation trace',
              ],
            ],
            [22, 38, 25, 15]
          ),

          new Paragraph({ spacing: { before: 180 } }),

          // MODULE 7: SETTINGS
          createHeading2('2.7 Module 7: Settings Module (Store, Taxes, Shipping, Locations)'),
          createParagraph(
            'The Settings module centralizes commerce infrastructure settings across four specialized sub-modules: General Store Settings, Tax Configuration, Shipping Settings, and Store Locations.'
          ),
          createTable(
            ['Sub-Module', 'Feature Capabilities & Rules', 'UI Display Location', 'Data Schema'],
            [
              [
                'Store General Settings',
                'Store Name, Support Email, Phone, Currency (INR / ₹), GSTIN identification, Store Address, Order Prefix, Low Stock Threshold.',
                'Settings > General (ui/admin/settings/core)',
                'EcommerceSettings (store object)',
              ],
              [
                'Tax Global Settings',
                'Taxes Enabled toggle, Prices Include Tax toggle (Gross vs. Net pricing), Tax Shipping by Default toggle, Display Tax Breakdown toggle.',
                'Settings > Taxes > General (ui/admin/settings/tax)',
                'EcommerceSettings (tax fields)',
              ],
              [
                'Tax Classes',
                'Manages product tax tiers (e.g., Standard Rate, Reduced Rate, Zero Rated, Exempt) with code, description, and shipping tax policy.',
                'Settings > Taxes > Classes (ui/admin/settings/tax/classes)',
                'EcommerceTaxClass',
              ],
              [
                'Tax Rules & Rates',
                'Geo-targeted tax rates by Country, State, and Postal Scope with multi-component tax breakdown (e.g., CGST + SGST) and priority.',
                'Settings > Taxes > Rules (ui/admin/settings/tax/rules)',
                'EcommerceTaxRule',
              ],
              [
                'Shipping Configuration',
                'Selects Flat Rate vs. Distance-Based shipping. Flat Rate defines fee & free shipping threshold. Distance defines rate/km, rounding, and fallback.',
                'Settings > Shipping (ui/admin/settings/shipping)',
                'EcommerceSettings (shipping fields)',
              ],
              [
                'Locations / Warehouses',
                'Multi-location manager capturing Warehouse Name, Address, City, State, Postal Code, Country, Latitude, Longitude, and Priority.',
                'Settings > Locations (ui/admin/settings/locations)',
                'EcommerceLocation',
              ],
            ],
            [20, 40, 25, 15]
          ),

          new Paragraph({ spacing: { before: 180 } }),

          // MODULE 8: STOREFRONT BLUEPRINTS
          createHeading2('2.8 Module 8: Storefront Module (Blueprint System & Pages)'),
          createParagraph(
            'The Storefront Blueprint module powers the visual layout, block order, and setting configurations for the 4 core customer-facing page types (Shop, Product Page, Cart, Checkout) while guaranteeing zero database mutations on public reads.'
          ),
          createTable(
            ['Feature Name', 'Functionality Description', 'UI Display Location', 'API Endpoint'],
            [
              [
                '4 Canonical Page Blueprints',
                'Pre-configured layouts for Shop (/shop), Product Detail (/product), Cart (/cart), and Checkout (/checkout).',
                'Storefront Overview (ui/admin/storefront/index.html)',
                'GET /storefront/admin/pages',
              ],
              [
                'Visual Blueprint Manager',
                'Interactive editor allowing merchants to toggle blocks on/off, reorder blocks, and customize field settings.',
                'Storefront Page Editors (shop, product, cart, checkout)',
                'GET/PUT /storefront/admin/pages/:pageType',
              ],
              [
                'In-Memory Default Fallback',
                'Synthesizes default blueprint configuration in-memory for unprovisioned tenants, ensuring public GET requests perform zero DB writes.',
                'Public Customer Storefront & Health Check',
                'GET /storefront/pages/:pageType, GET /storefront/health',
              ],
              [
                'Customization Protection',
                'Tracks applied blueprint version, blueprint hash, config hash, and revision count to prevent upstream updates from overwriting merchant edits.',
                'Blueprint status bar in Admin Editor',
                'PUT /storefront/admin/pages/:pageType',
              ],
              [
                'One-Click Reset',
                'Reverts a customized page back to the canonical default blueprint structure.',
                'Reset to Default button in Blueprint Editor',
                'POST /storefront/admin/pages/:pageType/reset',
              ],
            ],
            [22, 38, 25, 15]
          ),

          new Paragraph({ spacing: { before: 180 } }),

          // MODULE 9: STOREFRONT BLOCKS & ENGINE
          createHeading2('2.9 Module 9: Customer-Facing Storefront Engine & Blocks'),
          createParagraph(
            'The Storefront Engine compiles into ui/block/index.js and dynamically mounts into OpenExt published CMS pages. It delivers a modern, compact 4-column product catalog with responsive breakpoints and self-injecting CSS.'
          ),
          createTable(
            ['Feature / Component', 'Technical Specification & Design Rules', 'UI Display Location', 'Source Implementation'],
            [
              [
                'ProductGridBlock',
                'Responsive catalog grid: 4 columns on Desktop (>=1024px), 2 columns on Tablet (640-1023px), 1-2 columns on Mobile (<640px). Container max-width 84rem (1344px).',
                'Customer Storefront Published Pages',
                'web/src/storefront/blocks/ProductGridBlock.tsx',
              ],
              [
                'Multi-Source Data Feeds',
                'Supports 4 data sources: All Products, Latest Arrivals, Specific Category, or Manually Selected Product IDs (capped at 50 with order preservation).',
                'Product Grid Block settings',
                'GET /storefront/products',
              ],
              [
                'Effective Catalog Price Sorting',
                'MongoDB aggregation pipeline computes customer-visible catalogPrice factoring percentage & fixed discounts with stable _id tiebreakers.',
                'Sort dropdown on Storefront Grid',
                'GET /storefront/products?sort=price_asc',
              ],
              [
                'Reusable ProductCard',
                'Compact equal-height cards featuring 1:1 square contained images (object-fit: contain), 2-line title clamp, discount badges, stock dots, and aligned Add to Cart buttons.',
                'Mounted within ProductGrid & Admin Previews',
                'web/src/storefront/components/ProductCard.tsx',
              ],
              [
                'Request Cancellation & Anti-Stale',
                'Uses AbortController and request generation tokens to abort in-flight queries and ignore stale responses during rapid filter/page switching.',
                'Storefront catalog grid interactions',
                'activeAbortRef & activeRequestRef',
              ],
              [
                'Numeric Pagination',
                'Bounded numeric page buttons with ellipsis, Previous/Next controls, boundary clamping, and aria-current="page" accessibility.',
                'Storefront pagination bar',
                'ecom-sf-pagination',
              ],
              [
                'Self-Injecting CSS Architecture',
                'Bundled IIFE self-injects scoped stylesheet into document.head upon execution, preventing unstyled row blowouts regardless of host link injection.',
                'Browser runtime execution',
                'web/src/storefront/blockEntry.tsx',
              ],
            ],
            [20, 40, 25, 15]
          ),

          new Paragraph({ spacing: { before: 240 } }),

          // ----------------------------------------------------
          // SECTION 3.0: DATABASE DESIGN
          // ----------------------------------------------------
          createHeading1('3.0 Comprehensive Database Design & Schema Dictionary'),
          createParagraph(
            'The E-Commerce Plugin utilizes MongoDB through Mongoose. In OpenExt, plugin collections are registered in the active tenant/user database with the namespaced prefix "ecommerce-plugin_". Below are the verified metrics from live database inspection followed by detailed schema dictionaries for all 11 collections.'
          ),

          createHeading2('3.1 Live Database Collections & Volume Summary'),
          createTable(
            ['Collection Name', 'MongoDB Collection Key', 'Live Documents', 'Primary Indexes'],
            [
              ['Products', 'ecommerce-plugin_products', '35 active records', '_id, slug (unique), sku (unique)'],
              ['Categories', 'ecommerce-plugin_categories', '14 active records', '_id, slug (unique)'],
              ['Orders', 'ecommerce-plugin_ecommerceorders', '30 active records', '_id, orderNumber (unique)'],
              ['Discount Rules', 'ecommerce-plugin_ecommercediscountrules', '24 active records', '_id, code (sparse unique)'],
              ['Storefront Pages', 'ecommerce-plugin_ecommercestorefrontpages', '4 active records', '_id, tenantId_pageType, tenantId_slug'],
              ['Store Settings', 'ecommerce-plugin_ecommercesettings', '1 active record', '_id, tenantId'],
              ['Tax Rules', 'ecommerce-plugin_ecommercetaxrules', '6 active records', '_id, tenantId, taxClassId'],
              ['Tax Classes', 'ecommerce-plugin_ecommercetaxclasses', '3 active records', '_id, tenantId, code'],
              ['Locations', 'ecommerce-plugin_ecommercelocations', '1 active record', '_id, tenantId'],
              ['Collections', 'ecommerce-plugin_ecommercecollections', '1 active record', '_id, tenantId_handle'],
              ['Admin Profiles', 'ecommerce-plugin_ecommerceadminprofiles', '1 active record', '_id, tenantId_userId'],
            ],
            [25, 35, 18, 22]
          ),

          new Paragraph({ spacing: { before: 180 } }),

          createHeading2('3.2 Collection: Products (ecommerce-plugin_products)'),
          createParagraph('Stores all catalog inventory items, variants, pricing, and media assets.'),
          createTable(
            ['Field Name', 'BSON Type', 'Required / Default', 'Description & Validation'],
            [
              ['_id', 'ObjectId', 'Auto (Primary Key)', 'Unique identifier for the product.'],
              ['tenantId', 'String', 'default: "default_tenant"', 'Tenant isolation identifier.'],
              ['name', 'String', 'Required: true', 'Display title of the product.'],
              ['slug', 'String', 'Unique: true', 'URL-safe identifier derived from name.'],
              ['description', 'String', 'Optional', 'HTML / rich text product description.'],
              ['price', 'Number', 'Required: true', 'Base selling price in store currency.'],
              ['discountPrice', 'Number', 'Optional', 'Promotional selling price override.'],
              ['discountPercentage', 'Number', 'default: 0', 'Promotional discount percentage.'],
              ['costPrice', 'Number', 'Optional', 'Internal cost price for gross margin calculation.'],
              ['sku', 'String', 'Unique: true', 'Stock Keeping Unit (auto SKU-xxxxxx fallback).'],
              ['barcode', 'String', 'Optional', 'UPC / EAN / ISBN barcode string.'],
              ['stock', 'Number', 'default: 0', 'Current available inventory units.'],
              ['image', 'String', 'Optional', 'URL of the primary product thumbnail.'],
              ['images', 'Array<String>', 'default: []', 'List of image URLs for gallery.'],
              ['videos', 'Array<String>', 'default: []', 'List of video embed URLs.'],
              ['categoryId', 'ObjectId', 'Required: true (Ref: Category)', 'Foreign key link to Category.'],
              ['collectionId', 'ObjectId', 'Optional (Ref: Collection)', 'Foreign key link to Collection.'],
              ['status', 'String', 'enum: Draft, Published, Archived', 'Publishing lifecycle status.'],
              ['isTaxable', 'Boolean', 'default: true', 'Whether sales tax applies to product.'],
              ['taxClassId', 'String', 'default: "Default"', 'Associated tax classification.'],
              ['isDigital', 'Boolean', 'default: false', 'Flag for downloadable digital goods.'],
              ['tags', 'Array<String>', 'default: []', 'Search keywords and tags.'],
              ['metaTitle', 'String', 'Optional', 'SEO title tag.'],
              ['metaDescription', 'String', 'Optional', 'SEO meta description.'],
              ['variants', 'Array<Object>', 'Subdocument', 'Variant items (size, color, stock, sku, priceOverride).'],
              ['createdAt / updatedAt', 'Date', 'Auto timestamps', 'Audit timestamps.'],
            ],
            [22, 18, 25, 35]
          ),

          new Paragraph({ spacing: { before: 180 } }),

          createHeading2('3.3 Collection: Categories (ecommerce-plugin_categories)'),
          createParagraph('Stores hierarchical product categories for navigation and filtering.'),
          createTable(
            ['Field Name', 'BSON Type', 'Required / Default', 'Description & Validation'],
            [
              ['_id', 'ObjectId', 'Auto (Primary Key)', 'Unique identifier for the category.'],
              ['tenantId', 'String', 'default: "default_tenant"', 'Tenant isolation identifier.'],
              ['name', 'String', 'Required: true', 'Name of the category.'],
              ['slug', 'String', 'Unique: true', 'URL-safe slug.'],
              ['description', 'String', 'Optional', 'Description of category.'],
              ['image', 'String', 'Optional', 'Banner/thumbnail image URL.'],
              ['parentId', 'ObjectId', 'default: null (Ref: Category)', 'Self-referencing foreign key for nested trees.'],
              ['metaTitle', 'String', 'Optional', 'SEO title.'],
              ['metaDescription', 'String', 'Optional', 'SEO description.'],
              ['createdAt / updatedAt', 'Date', 'Auto timestamps', 'Audit timestamps.'],
            ],
            [22, 18, 25, 35]
          ),

          new Paragraph({ spacing: { before: 180 } }),

          createHeading2('3.4 Collection: Orders (ecommerce-plugin_ecommerceorders)'),
          createParagraph('Stores sales orders, line items, customer info, fulfillment, and financial audits.'),
          createTable(
            ['Field Name', 'BSON Type', 'Required / Default', 'Description & Validation'],
            [
              ['_id', 'ObjectId', 'Auto (Primary Key)', 'Unique order record identifier.'],
              ['tenantId', 'String', 'default: "default_tenant"', 'Tenant isolation identifier.'],
              ['orderNumber', 'String', 'Unique: true', 'Human-readable ID (e.g. ORD-682109).'],
              ['source', 'String', 'enum: admin_cart, storefront, manual', 'Origin channel of the transaction.'],
              ['customerDetails', 'Object', 'Required (name, email, phone, address)', 'Customer contact and shipping identity.'],
              ['shippingAddress', 'Object', 'addressLine1/2, city, state, postal, country', 'Structured shipping destination.'],
              ['items', 'Array<Object>', 'Subdocument itemSchema', 'Line items with productId, sku, price, qty, discounts.'],
              ['pricing', 'Object', 'subtotal, discount, tax, shipping, totalAmount', 'Complete financial breakdown and snapshots.'],
              ['couponCode', 'String', 'Optional', 'Coupon code applied to order.'],
              ['status', 'String', 'enum: Pending, Processing, Shipped, Delivered, Cancelled', 'Overall order lifecycle status.'],
              ['paymentStatus', 'String', 'enum: Not paid, Paid, Partially refunded, Refunded', 'Financial settlement status.'],
              ['payment', 'Object', 'method, reference, capturedAmount, capturedAt', 'Payment gateway transaction details.'],
              ['refunds', 'Array<Object>', 'amount, reason, note, at', 'Refund transaction audit log.'],
              ['fulfillmentStatus', 'String', 'enum: Not fulfilled, Fulfilled, Shipped, Delivered', 'Logistics fulfillment status.'],
              ['fulfillment', 'Object', 'carrier, trackingNumber, fulfilledAt, shippedAt', 'Courier logistics details.'],
              ['notes', 'Array<Object>', 'text, at', 'Staff administrative notes.'],
              ['events', 'Array<Object>', 'type, message, at', 'Immutable audit trail of order events.'],
              ['createdAt / updatedAt', 'Date', 'Auto timestamps', 'Audit timestamps.'],
            ],
            [22, 18, 25, 35]
          ),

          new Paragraph({ spacing: { before: 180 } }),

          createHeading2('3.5 Collection: Discount Rules (ecommerce-plugin_ecommercediscountrules)'),
          createParagraph('Stores all promotional rules, BOGO configurations, spend thresholds, and campaigns.'),
          createTable(
            ['Field Name', 'BSON Type', 'Required / Default', 'Description & Validation'],
            [
              ['_id', 'ObjectId', 'Auto (Primary Key)', 'Unique discount rule identifier.'],
              ['tenantId', 'String', 'default: "default_tenant"', 'Tenant isolation identifier.'],
              ['name', 'String', 'Required: true', 'Descriptive promotion title.'],
              ['code', 'String', 'Sparse Unique', 'Coupon code entered at checkout (empty if automatic).'],
              ['isAutomatic', 'Boolean', 'default: false', 'Whether rule triggers automatically.'],
              ['type', 'String', 'percentage, fixed_amount, buy_x_get_y, free_gift, spend_x_get_y, campaign, custom', 'Core promotion engine type.'],
              ['value', 'Number', 'default: 0', 'Discount value (percentage rate or fixed amount).'],
              ['status', 'String', 'enum: Active, Draft, Paused, Archived', 'Rule execution status.'],
              ['startDate / endDate', 'Date', 'Optional', 'Scheduled promotional time window.'],
              ['minSubtotal', 'Number', 'default: 0', 'Minimum qualifying order subtotal.'],
              ['targetProductIds', 'Array<String>', 'default: []', 'Specific product IDs eligible for discount.'],
              ['buyXGetY', 'Object', 'buyTargetType/Ids/Qty, rewardTargetType/Ids/Qty/Type/Val, repeat', 'Complete BOGO configuration parameters.'],
              ['spendXGetY', 'Object', 'minSpend, rewardType, rewardValue, maxDiscount, repeat', 'Spend threshold reward parameters.'],
              ['freeGift', 'Object', 'productId', 'Product ID injected as free gift.'],
              ['campaign', 'Object', 'childRuleIds, description, storefrontDisplay, marketingHeading', 'Marketing umbrella campaign group.'],
              ['priority', 'Number', 'default: 0', 'Calculation priority ordering.'],
              ['stackingPolicy', 'String', 'enum: allow, exclusive', 'Stacking permission with other rules.'],
              ['usageLimit', 'Number', 'Optional', 'Maximum global redemption count.'],
              ['usedCount', 'Number', 'default: 0', 'Cumulative redemption counter.'],
            ],
            [22, 18, 25, 35]
          ),

          new Paragraph({ spacing: { before: 180 } }),

          createHeading2('3.6 Collection: Storefront Pages (ecommerce-plugin_ecommercestorefrontpages)'),
          createParagraph('Stores editable blueprint configurations, block orders, versions, and custom settings.'),
          createTable(
            ['Field Name', 'BSON Type', 'Required / Default', 'Description & Validation'],
            [
              ['_id', 'ObjectId', 'Auto (Primary Key)', 'Unique storefront page identifier.'],
              ['tenantId', 'String', 'Required, Indexed', 'Tenant isolation identifier.'],
              ['pageType', 'String', 'enum: shop, product, cart, checkout', 'Canonical page blueprint type.'],
              ['blueprintId', 'String', 'Required: true', 'Identifier of the base blueprint definition.'],
              ['cmsPageId', 'String', 'default: null', 'Link to host OpenExt Page model if synced.'],
              ['slug', 'String', 'Required, Indexed', 'URL route pattern for page.'],
              ['title', 'String', 'Required: true', 'Customer-facing page title.'],
              ['description', 'String', 'default: ""', 'Page purpose and meta description.'],
              ['routePattern', 'String', 'Required: true', 'Express route matching pattern.'],
              ['isPublished', 'Boolean', 'default: true', 'Publication visibility status.'],
              ['appliedBlueprintVersion', 'Number', 'default: 1', 'Version number of applied blueprint.'],
              ['appliedBlueprintHash', 'String', 'Required: true', 'MD5 hash of the original blueprint.'],
              ['currentConfigHash', 'String', 'Required: true', 'MD5 hash of current block configuration.'],
              ['isCustomized', 'Boolean', 'default: false', 'Flag indicating merchant made modifications.'],
              ['revision', 'Number', 'default: 1', 'Incremental revision change counter.'],
              ['blocks', 'Array<Object>', 'Subdocument blockConfigSchema', 'Ordered blocks (id, uniqueId, blockType, enabled, settings).'],
              ['createdAt / updatedAt', 'Date', 'Auto timestamps', 'Audit timestamps.'],
            ],
            [22, 18, 25, 35]
          ),

          new Paragraph({ spacing: { before: 180 } }),

          createHeading2('3.7 Collections: Settings, Taxes, Locations & Collections'),
          createParagraph('Specialized configuration schemas supporting commerce operations:'),
          createTable(
            ['Collection Name', 'Key Fields & Types', 'Primary Role & Settings'],
            [
              [
                'EcommerceSettings (ecommerce-plugin_ecommercesettings)',
                'taxesEnabled (Bool), defaultTaxClassId (Str), pricesIncludeTax (Bool), shippingMethod (Enum: Flat, Distance), shippingRate (Num), freeShippingThreshold (Num), shippingRatePerKm (Num), locationSelection (Enum), store (Object: name, gstin, address, phone)',
                'Central configuration for store identity, global tax computation policy, and shipping rate calculations.',
              ],
              [
                'EcommerceTaxClass (ecommerce-plugin_ecommercetaxclasses)',
                'name (Str), code (Str), description (Str), status (Enum: Active, Inactive), shippingTaxPolicy (Enum: UseGlobal, Taxable, NonTaxable)',
                'Defines tax classifications assigned to products (e.g. Standard, Reduced, Exempt).',
              ],
              [
                'EcommerceTaxRule (ecommerce-plugin_ecommercetaxrules)',
                'name (Str), taxClassId (Ref: TaxClass), country (Str), state (Str), postalScope (Str), components (Array<{label, rate}>), priority (Num), status (Enum)',
                'Geo-targeted tax calculation rules providing multi-component tax breakdown (e.g. CGST 9% + SGST 9%).',
              ],
              [
                'EcommerceLocation (ecommerce-plugin_ecommercelocations)',
                'name (Str), addressLine1/2, city, state, postalCode, country, latitude (Num), longitude (Num), status (Enum), priority (Num)',
                'Physical warehouses and retail stores used for distance-based shipping and fulfillment selection.',
              ],
              [
                'EcommerceCollection (ecommerce-plugin_ecommercecollections)',
                'title (Str), handle (Str), description (Str), tenantId',
                'Curated product groupings and promotional collections.',
              ],
              [
                'EcommerceAdminProfile (ecommerce-plugin_ecommerceadminprofiles)',
                'userId (Ref: User), displayName, jobTitle, phone, dashboardDays',
                'Staff user preferences and dashboard view settings.',
              ],
            ],
            [25, 45, 30]
          ),

          new Paragraph({ spacing: { before: 240 } }),

          // ----------------------------------------------------
          // SECTION 4.0: ENTITY RELATIONSHIP MATRIX
          // ----------------------------------------------------
          createHeading1('4.0 Entity-Relationship Matrix & Cross-Collection Dependencies'),
          createParagraph(
            'The database models form a cohesive relational network linked via BSON ObjectIds and tenant boundaries:'
          ),
          createBullet(
            'Links each product to its category hierarchy. Required on all product records.',
            'Product -> Category: '
          ),
          createBullet(
            'Links products to promotional or seasonal groupings.',
            'Product -> Collection: '
          ),
          createBullet(
            'Each order line item records the Product ObjectId for inventory synchronization and price auditing.',
            'Order -> Product (Items): '
          ),
          createBullet(
            'Every tax rule targets a specific Tax Class ObjectId to compute rate components.',
            'TaxRule -> TaxClass: '
          ),
          createBullet(
            'Discount rules reference targeted Product and Category ObjectIds for item-level promotions.',
            'DiscountRule -> Product / Category: '
          ),
          createBullet(
            'Store settings link to the primary dispatch location for distance-based shipping measurements.',
            'Settings -> Location: '
          ),

          new Paragraph({ spacing: { before: 240 } }),

          // ----------------------------------------------------
          // SECTION 5.0: PACKAGING & BUILD REFERENCE
          // ----------------------------------------------------
          createHeading1('5.0 Plugin Packaging & Build Pipeline Reference'),
          createParagraph(
            'To compile, bundle, and package the complete plugin into the distribution ZIP for OpenExt, execute the following commands in sequence:'
          ),
          createCallout(
            'OFFICIAL BUILD COMMAND SEQUENCE',
            '1. Compile Backend: cd plugin/ecommerce-plugin && npm run build\n' +
            '2. Build Storefront Block Bundle: cd ../../web && npm run build:block\n' +
            '3. Export Next.js Admin UI: npm run build\n' +
            '4. Generate Distribution ZIP: node scripts/package-plugin.mjs\n\n' +
            'Output Package: ecommerce-plugin-dev/ecommerce-plugin.zip (Verified: 162 runtime files, < 50MB, manifest at root).'
          ),

          new Paragraph({ spacing: { before: 360 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: '— END OF OFFICIAL ARCHITECTURE SPECIFICATION —',
                size: 20,
                color: COLOR_MUTED,
                bold: true,
                font: FONT_FAMILY,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const outputPath = path.resolve('C:/Users/InsiyaMerchant/Projects/ecommerce-plugin-dev', 'OpenExt_Ecommerce_Plugin_Official_Documentation.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);

  console.log(`Successfully generated official Word document at: ${outputPath}`);
  console.log(`Document size: ${buffer.length} bytes`);
}

generateDoc().catch((err) => {
  console.error('Error generating document:', err);
  process.exit(1);
});
