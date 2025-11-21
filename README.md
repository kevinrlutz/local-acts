# Local Acts

A cross-platform mobile and web application that connects local talent and their fans. Discover musicians, bands, and comedians in your area, follow your favorites, and never miss a local show.

## ✨ Features

### For Fans
- **Location-based discovery**: Find acts within a specified distance from your city or zip code
- **Smart filtering**: Filter by category (Musician, Comedian, Other) and explore nearby talent
- **Act profiles**: View detailed profiles with photos, upcoming events, and social media links
- **(Coming soon) Favorites**: Save your favorite acts and get notified about new events
- **Cross-platform**: Works seamlessly on iOS, Android, and web

### For Artists
- **Professional profiles**: Create comprehensive act profiles with photos and social links
- **Location targeting**: Set your performance location to be discovered by local fans
- **Social integration**: Connect Spotify, Apple Music, and Instagram profiles
- **(Coming soon) Event management**: Share upcoming shows and performances

## 🛠️ Tech Stack

- **Frontend**: React Native with Expo for cross-platform development
- **Authentication**: Firebase Authentication with email/password
- **Database**: Cloud Firestore for real-time data storage
- **Location Services**: Mapbox Geocoding API for address resolution

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or later)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kevinrlutz/local-acts.git
   cd local-acts
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Run on your preferred platform**
   - **Web**: Press `w` in the terminal or `npm run web`
   - **iOS**: Press `i` or `npm run ios` (macOS with Xcode required)
   - **Android**: Press `a` or `npm run android` (Android Studio required)

## 🏗️ Development

### Project Structure
```
local-acts/
├── app/                    # Expo Router app directory
│   ├── _layout.tsx        # Root layout
│   ├── index.tsx          # Home screen
│   ├── (auth)/            # Authentication screens
│   └── act/               # Act-related screens
├── src/
│   ├── lib/               # Core libraries (Firebase config)
│   ├── services/          # Business logic (API calls, data processing)
│   └── types/             # TypeScript type definitions
└── assets/                 # Static assets (images, icons)
```

### Key Development Features

- **TypeScript Integration**: Comprehensive type safety with custom interfaces for user profiles, act data, and API responses
- **Modular Architecture**: Clean separation of concerns with dedicated service layers for Firebase operations, location services, and data validation
- **Responsive Design**: Adaptive layouts that work across different screen sizes and orientations
- **Error Handling**: Robust error boundaries and user-friendly error messages
- **Performance Optimization**: Efficient data fetching with caching and background updates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
