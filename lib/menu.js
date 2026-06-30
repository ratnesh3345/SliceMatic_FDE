// lib/menu.js — local menu (no database needed). Edit here or load from a file later.
export const DEFAULT_MENU = {
  base: [
    { item_code: "B1", name: "Thin Crust", price: 149 },
    { item_code: "B2", name: "Thick Crust", price: 179 },
    { item_code: "B3", name: "Cheese Burst", price: 229 },
    { item_code: "B4", name: "Whole Wheat", price: 159 },
    { item_code: "B5", name: "Multigrain", price: 169 },
  ],
  pizza: [
    { item_code: "P1", name: "Margherita", price: 299 },
    { item_code: "P2", name: "Chicago Deep Dish", price: 349 },
    { item_code: "P3", name: "Greek Mediterranean", price: 329 },
    { item_code: "P4", name: "California Veggie", price: 339 },
    { item_code: "P5", name: "Farm House", price: 319 },
    { item_code: "P6", name: "Pepperoni Classic", price: 369 },
    { item_code: "P7", name: "BBQ Chicken", price: 379 },
    { item_code: "P8", name: "Paneer Tikka", price: 349 },
  ],
  topping: [
    { item_code: "T1", name: "Black Olives", price: 49 },
    { item_code: "T2", name: "Extra Cheese", price: 69 },
    { item_code: "T3", name: "Button Mushrooms", price: 49 },
    { item_code: "T4", name: "Green Peppers", price: 39 },
    { item_code: "T5", name: "Jalapenos", price: 39 },
    { item_code: "T6", name: "Sun-Dried Tomatoes", price: 59 },
    { item_code: "T7", name: "Caramelised Onions", price: 49 },
    { item_code: "T8", name: "Sweet Corn", price: 39 },
    { item_code: "T9", name: "Roasted Garlic", price: 49 },
    { item_code: "T10", name: "Peri-Peri Drizzle", price: 59 },
  ],
};

export async function loadMenu() {
  return { menu: DEFAULT_MENU, source: "local" };
}
