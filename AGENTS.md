# AGENTS.md

## 1. Project Overview

**Local Acts** is a cross-platform React Expo application supporting **web**, **Android**, and **iOS**. The service allows users to discover local talent—including musicians, bands, and comedians—based on geographic location.

Users log in and specify a **city name or zip code** with a **distance range**. They are then shown a list of local acts within the specified radius. This list can be **filtered** by attributes such as category and popularity. Users may **favorite** acts and receive **notifications** about new events. Selecting an act opens its detailed profile page, which displays:

- Act name and category  
- Profile picture  
- Upcoming events  
- Links to social platforms and music pages (e.g., Spotify, Apple Music)

Acts signing up for the platform provide a **location to be discovered** (city or zip code) and create an act profile with the same information listed above.

---

## 2. Tech Stack

- **React Expo** (web + Android + iOS)
- **Firebase Authentication** (email/password, Google)
- **Firestore** database
- **Mapbox Geocoding API** for location search and distance queries
- **Jest** for unit testing

---

## 3. Build Commands

Build and run the project with: **"npm run start"**  
For debugging Expo issues, run: **"npx expo-doctor"**

---

## 4. Testing Instructions

- All unit tests must be written using **Jest**.  
- Achieve **100% code coverage** for any methods, files, or lines specified by the user.  
- Do **not** duplicate existing test files or test cases—only generate **new** ones when required.  

---

## 5. Security Considerations

- Do **not** store sensitive data locally.  
- All authentication must be handled through **Firebase Auth**.  
- Any credentials for external services (API keys, client IDs, auth tokens, etc.) must be stored exclusively in **environment variables**.  
- Never hardcode sensitive values directly in the application code.