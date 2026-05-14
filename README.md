# GardenMate 🌱

**GardenMate** is a comprehensive React Native & Expo application designed to bridge the gap between plant enthusiasts, local nurseries, and administrators. The application leverages modern technologies including Augmented Reality (AR) and Firebase to deliver a seamless plant shopping, care, and community experience.

## ✨ Key Features

### For Plant Lovers (Users)
- **AR Plant Preview:** Visualize how plants will look in your specific room or space before purchasing.
- **Plant Care Management:** Track your personal plants with reminders for watering, lighting, and humidity.
- **Marketplace:** Browse and purchase plants, pots, tools, and accessories from various local vendors.
- **Community:** Connect with other plant enthusiasts, share updates, and seek gardening advice.
- **Customer Support System:** Built-in ticketing system for quick issue resolution.

### For Nurseries & Sellers (Vendors)
- **Inventory Management:** Effortlessly add, edit, and track stock for plants and gardening accessories.
- **Order Processing:** Track incoming orders, manage shipping statuses, and fulfill customer requests.
- **Customer Chat:** Built-in direct messaging system for handling buyer inquiries.
- **Financial Dashboard:** Monitor sales, earnings, platform commissions, and manage payouts.

### For Platform Managers (Admins)
- **System Overview:** Comprehensive analytics and activity dashboard.
- **User/Vendor Management:** Handle account approvals, suspensions, and disputes.
- **Commission System:** Manage platform fees and vendor payout schedules.
- **Support Escalation:** Handle high-priority tickets, refunds, and vendor complaints.

## 🛠️ Technology Stack

- **Frontend Framework:** React Native with Expo (`@react-navigation`)
- **Backend & Database:** Firebase (Authentication, Firestore Database)
- **State Management:** React Context API
- **Animations:** React Native Reanimated & Gesture Handler
- **Device Features:** Expo Camera, Expo Location, Expo Image Picker
- **Local Storage:** AsyncStorage

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or newer recommended)
- npm or yarn
- Expo Go app on your physical device (or Android Studio / Xcode for emulators)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/umairulhassancs/gardenmate.git
   cd gardenmate
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add your Firebase and OpenRouter API keys:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   EXPO_PUBLIC_OPENROUTER_API_KEY=your_openrouter_key
   ```

4. **Start the application**
   ```bash
   npm start
   ```
   *Scan the QR code with the Expo Go app on your phone, or press `a` to run on an Android emulator.*

## 📁 Project Structure Overview

- `/assets`: Images, icons, splash screens, and static assets.
- `/scripts`: Utility scripts for database seeding and testing.
- `/src/api`: External API integrations.
- `/src/components`: Reusable UI components.
- `/src/contexts`: React Context providers for global state management (Auth, Cart, Orders, Chat).
- `/src/hooks`: Custom React hooks.
- `/src/navigation`: App routing configurations.
- `/src/screens`: Main view components categorized by user roles (`/admin`, `/vendor`, and standard user screens).
- `/src/services`: Core services (Firebase initialization, Notifications, Audit trailing).
- `/src/theme`: Centralized styling, colors, and design tokens.
- `/src/utils`: Helper functions (date formatting, currency, etc.).

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Built with ❤️ for plant lovers everywhere.*