// lib/pricing.test.mjs  — run with: npm run test:pricing
import assert from "node:assert";
import {
  computeBill, validateName, validatePhone, validateQuantity, paymentConfirmation,
} from "./pricing.js";

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); console.log("  ✓ " + msg); passed++; };

// Reference sample bill: Cheese Burst 229 + BBQ Chicken 379 + Extra Cheese 69, qty 5
const sel = {
  base:    { name: "Cheese Burst", price: 229 },
  pizza:   { name: "BBQ Chicken",  price: 379 },
  topping: { name: "Extra Cheese", price: 69 },
};

const b5 = computeBill(sel, 5);
ok(b5.subtotal === 3385, "qty 5 subtotal = ₹3385");
ok(b5.discount === 338.5, "qty 5 discount = ₹338.50 (10%)");
ok(b5.gst === 548.37, "GST on post-discount = ₹548.37");
ok(b5.total === 3594.87, "final total = ₹3594.87 (matches reference)");

const b1 = computeBill(sel, 1);
ok(b1.discount === 0, "qty 1 → no discount");
ok(b1.gst === 121.86, "qty 1 GST = ₹121.86");
ok(b1.total === 798.86, "qty 1 total = ₹798.86");

// Validation edge cases
ok(validateName("   ") !== null, "name of only spaces is rejected");
ok(validateName("Ravi2") !== null, "name with a digit is rejected");
ok(validateName("Ravi Kumar") === null, "valid name accepted");
ok(validatePhone("1876543210") !== null, "phone starting with 1 is rejected");
ok(validatePhone("98765") !== null, "short phone is rejected");
ok(validatePhone("9876543210") === null, "valid phone accepted");
ok(validateQuantity("0") !== null, "quantity 0 is rejected");
ok(validateQuantity("11") !== null, "quantity 11 is rejected");
ok(validateQuantity("2.5") !== null, "non-integer quantity is rejected");
ok(validateQuantity("three") !== null, "word quantity is rejected");
ok(validateQuantity("3") === null, "quantity 3 accepted");

// Per-mode payment messages differ
ok(paymentConfirmation("Cash", 100) !== paymentConfirmation("UPI", 100), "payment messages are mode-specific");

console.log(`\nAll ${passed} pricing/validation checks passed.`);

// ---- Cart engine ----
import { computeCart } from "./pricing.js";
const A = { base:{name:"Cheese Burst",price:229}, pizza:{name:"BBQ Chicken",price:379}, topping:{name:"Extra Cheese",price:69}, quantity:5 };
const cart1 = computeCart([A]);
ok(cart1.total === 3594.87, "cart: single line of 5 matches reference total ₹3594.87");

// two different pizzas, one with no topping; 3 + 2 = 5 pizzas -> discount kicks in
const B = { base:{name:"Thin Crust",price:149}, pizza:{name:"Margherita",price:299}, topping:null, quantity:2 };
const C = { base:{name:"Cheese Burst",price:229}, pizza:{name:"BBQ Chicken",price:379}, topping:{name:"Extra Cheese",price:69}, quantity:3 };
const cart2 = computeCart([B, C]);
ok(cart2.totalPizzas === 5, "cart: two lines total 5 pizzas");
ok(cart2.discountApplies === true, "cart: 5 total pizzas triggers discount across lines");
ok(cart2.lines[0].topping === null, "cart: a line with no topping is allowed");
// subtotal = 2*(149+299) + 3*(229+379+69) = 896 + 2031 = 2927
ok(cart2.subtotal === 2927, "cart: mixed-basket subtotal = ₹2927");

console.log(`\nAll ${passed} checks passed (incl. cart).`);
