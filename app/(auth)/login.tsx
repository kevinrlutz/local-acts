import { Href, useRouter } from 'expo-router'
import { signInWithEmailAndPassword } from 'firebase/auth'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { auth } from '@/src/lib/firebase'

import Colors from '../../src/Colors'

const { width: screenWidth } = Dimensions.get('window');
const isMobile = screenWidth < 768;

const SIGN_UP_ROUTE = '/(auth)/sign-up' as Href
const HOME_ROUTE = '/' as Href

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Login - Local Acts";
    }
  }, []);

  const showError = (message: string) => {
    setError(message)
    Alert.alert('Login error', message)
  }

  const navigateHome = () => {
    router.replace(HOME_ROUTE)
  }

  const goToSignUp = () => {
    router.push(SIGN_UP_ROUTE)
  }

  const handleLogin = async () => {
    try {
      setIsSubmitting(true)
      setError(null)
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) {
        throw new Error('Email address is required.')
      }
      if (!password) {
        throw new Error('Password is required.')
      }
      await signInWithEmailAndPassword(auth, normalizedEmail, password)
      navigateHome()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to sign you in. Please try again.'
      showError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={styles.logo}
              accessibilityRole="image"
              accessibilityLabel="Local Acts logo"
            />
            <Text style={styles.title}>Local Acts</Text>
            <Text style={styles.subtitle}>
              Discover and track local acts near you.
            </Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                inputMode="email"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@email.com"
                placeholderTextColor={Colors.primaryWhite}
                style={styles.input}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Enter your password"
                placeholderTextColor={Colors.primaryWhite}
                style={styles.input}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[
                styles.primaryButton,
                isSubmitting && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isSubmitting}
              accessibilityRole="button"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Log In</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.createAccountRow}>
            <Text style={styles.createAccountText}>Need an account?</Text>
            <Pressable onPress={goToSignUp} accessibilityRole="button">
              <Text style={styles.createAccountLink}>Create one</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: isMobile ? 12 : 24,
    gap: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    gap: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: Colors.primaryWhite,
  },
  subtitle: {
    color: Colors.secondaryGray,
    fontSize: 16,
  },
  formContainer: {
    alignItems: 'center',
    width: '100%',
  },
  formGroup: {
    gap: 6,
    marginBottom: 12,
    width: isMobile ? '100%' : '60%',
  },
  label: {
    color: Colors.primaryWhite,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.secondaryBackground,
    color: Colors.primaryWhite,
  },
  errorText: {
    color: '#FF5A5F',
    fontSize: 14,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: Colors.action,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
    width: isMobile ? '100%' : '60%',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: Colors.secondaryBackground,
    fontWeight: '700',
    fontSize: 16,
  },
  createAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  createAccountText: {
    color: Colors.secondaryGray,
  },
  createAccountLink: {
    color: Colors.primaryWhite,
    fontWeight: '600',
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
  },
})
