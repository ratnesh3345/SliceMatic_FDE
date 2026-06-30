# 🍕 SliceMatic – AI Powered Pizza Ordering System

SliceMatic is a modern full-stack pizza ordering application built with **Next.js**, **Supabase**, **OpenRouter AI**, and **n8n** automation.

The application allows customers to place pizza orders, receive AI-powered recommendations based on their previous orders, and receive WhatsApp notifications throughout the ordering process. Store owners also receive instant order notifications to begin preparation.

---

# 🚀 Features

## 👤 Customer Features

- Browse pizza menu
- Choose:
  - Pizza
  - Crust
  - Toppings
  - Quantity
- Automatic pricing calculation
- GST calculation
- Discount support
- AI-based pizza recommendations
- Place order
- WhatsApp order confirmation
- WhatsApp "Out For Delivery" notification

---

## 👨‍🍳 Admin Features

- Secure admin login
- View all orders
- Filter orders
- Search orders
- Update order status

Order workflow:

```
PLACED
   ↓
ACCEPTED
   ↓
OUT_FOR_DELIVERY
   ↓
DELIVERED
```

Updating an order to **OUT_FOR_DELIVERY** automatically triggers a WhatsApp notification to the customer.

---

# 🤖 AI Recommendation Engine

Powered by **OpenRouter API**.

The recommendation engine:

- Reads customer's previous orders
- Understands ordering history
- Suggests one personalized pizza combination
- Falls back to a predefined recommendation if AI is unavailable

Example:

> "Welcome back! Since you enjoyed Farm House previously, try a Cheese Burst Farm House with Sweet Corn."

---

# 📲 WhatsApp Automation

Built using **n8n**.

Two workflows are implemented.

## 1. New Order Workflow

Customer receives:

- Order confirmation
- Items ordered
- Total amount
- Delivery address

Store owner receives:

- Complete order details
- Customer information
- Total
- Preparation reminder

---

## 2. Out For Delivery Workflow

Automatically triggered when the admin changes the order status to:

```
OUT_FOR_DELIVERY
```

Customer receives:

- Delivery notification
- Delivery address
- ETA

---

# 🗄 Database

The project originally used a local JSON file.

It has now been migrated to **Supabase PostgreSQL**.

Orders are stored permanently in the cloud.

Main table:

```
orders
```

Stores:

- Customer information
- Items
- Pricing
- GST
- Discounts
- Status
- Payment method
- Order timestamps

---

# 🏗 Tech Stack

Frontend

- Next.js 14
- React
- Tailwind CSS

Backend

- Next.js API Routes

Database

- Supabase PostgreSQL

Automation

- n8n

AI

- OpenRouter API

Deployment

- Vercel

Version Control

- Git
- GitHub

---

# 📁 Project Structure

```
app/
    admin/
    api/
        admin/
        orders/
        recommend/

components/

lib/
    menu.js
    pricing.js
    store.js
    supabase.js
    webhook.js

public/

n8n/

package.json
```

---

# ⚙ Environment Variables

Create a `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

OPENROUTER_API_KEY=
OPENROUTER_MODEL=

N8N_WEBHOOK_URL=
N8N_DELIVERY_WEBHOOK_URL=

ADMIN_PASSWORD=
```

---

# 💻 Installation

Clone repository

```bash
git clone <repository-url>
```

Install dependencies

```bash
npm install
```

Run development server

```bash
npm run dev
```

Application runs at

```
http://localhost:3000
```

---

# 🚀 Deployment

This project is designed for deployment on **Vercel**.

Deployment steps:

1. Push repository to GitHub
2. Import project into Vercel
3. Add environment variables
4. Deploy

---

# 📡 APIs

## Orders

```
POST /api/orders
```

Create new order

```
GET /api/orders
```

Retrieve all orders

---

## Order Status

```
POST /api/orders/status
```

Update order status

Automatically triggers WhatsApp delivery notification.

---

## AI Recommendation

```
POST /api/recommend
```

Returns one personalized pizza recommendation.

---

# 📈 Future Improvements

- Customer authentication
- Live order tracking
- Payment gateway integration
- Coupon engine
- Analytics dashboard
- Inventory management
- Multi-store support
- Delivery partner dashboard
- Email notifications
- Mobile application

---

# 👨‍💻 Developed By

**Ratnesh Singhaniya**

Built as a full-stack assignment demonstrating:

- Next.js
- React
- REST APIs
- Supabase
- PostgreSQL
- AI Integration
- Workflow Automation
- Cloud Deployment

---
