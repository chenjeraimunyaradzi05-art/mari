/**
 * App Navigator
 * Main navigation structure for ATHENA mobile app
 *
 * The bottom bar is Feed / Explore / Jobs / Community / More / Profile. More
 * is the hub for every pillar (wellness, cars, the money plans, finance,
 * formation, the marketplace, apprenticeships, messages) and for the rows
 * that used to sit on Profile; Profile keeps identity and settings.
 *
 * Pillar routes whose native screens are still being written are registered
 * now under their final names with an "opens on the web" placeholder, so a
 * tap in More is never dead and the real screen only has to swap the import.
 */
import React from 'react';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackNavigationProp, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, StyleSheet, TouchableOpacity } from 'react-native';

// Screens
import { HomeScreen } from '../screens/HomeScreen';
import { JobsScreen } from '../screens/JobsScreen';
import { JobDetailScreen } from '../screens/JobDetailScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { ChatDetailScreen } from '../screens/ChatDetailScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ProfileEditScreen } from '../screens/ProfileEditScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ApplicationsScreen } from '../screens/ApplicationsScreen';
import { SavedJobsScreen } from '../screens/SavedJobsScreen';
import { HelpSupportScreen } from '../screens/HelpSupportScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';

// Super App Screens
import { VideoFeedScreen } from '../screens/VideoFeedScreen';
import { VideoCommentsScreen } from '../screens/VideoCommentsScreen';
import { ChannelsScreen } from '../screens/ChannelsScreen';
import { ApprenticeshipsScreen } from '../screens/ApprenticeshipsScreen';
import { SkillsMarketplaceScreen } from '../screens/SkillsMarketplaceScreen';
import { ServiceDetailScreen } from '../screens/ServiceDetailScreen';
import { MyOrdersScreen } from '../screens/MyOrdersScreen';

// Parity screens
import { PostCommentsScreen } from '../screens/PostCommentsScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import { GroupDetailScreen } from '../screens/GroupDetailScreen';
import { SafetyScreen } from '../screens/SafetyScreen';
import { MentorsScreen } from '../screens/MentorsScreen';
import { LearnScreen } from '../screens/LearnScreen';
import { CourseScreen } from '../screens/CourseScreen';
import { UpgradeScreen } from '../screens/UpgradeScreen';

// Pillar placeholders: replace each import with the native screen as it lands.
import { OpensOnWebScreen, opensOnWeb } from '../screens/OpensOnWebScreen';

/** The four strategy plans, as server/src/routes/strategy.routes.ts names them. */
export type StrategyArea = 'HOUSING' | 'BUSINESS' | 'TAX' | 'INVESTMENT';

// Types
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  JobDetail: { jobId: string };
  Messages: undefined;
  ChatDetail: { conversationId: string; participantName?: string };
  VideoComments: { videoId: string; title?: string };
  Notifications: undefined;
  Apprenticeships: undefined;
  SkillsMarketplace: undefined;
  ServiceDetail: { serviceId: string; title?: string };
  MyOrders: undefined;
  Settings: undefined;
  ProfileEdit: undefined;
  Applications: undefined;
  SavedJobs: undefined;
  HelpSupport: undefined;
  PostComments: { postId: string };
  Groups: undefined;
  GroupDetail: { groupId: string; name?: string };
  Safety: undefined;
  Mentors: undefined;
  Learn: undefined;
  Course: { courseId: string; title?: string };
  Upgrade: undefined;
  // Pillars. Registered with placeholders until their native screens land.
  Wellness: undefined;
  WellnessCheckIn: undefined;
  WellnessK10: undefined;
  Cars: undefined;
  CarCatalogue: undefined;
  CarDetail: { slug: string; title?: string };
  CarListings: undefined;
  CarListingDetail: { listingId: string; title?: string };
  Strategy: { area?: StrategyArea } | undefined;
  Calculator: { calculator: string; title?: string };
  MyPlans: undefined;
  Finance: undefined;
  SavingsGoal: { goalId?: string } | undefined;
  Formation: undefined;
  FormationDetail: { registrationId: string; name?: string };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Jobs: undefined;
  Community: undefined;
  More: undefined;
  Profile: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

// ---------------------------------------------------------------------------
// Pillar placeholders. Each renders the "opens on the web" pattern with the
// page that pillar lives on today. The wellness, cars, strategy, finance and
// formation agents replace these with their screens under the same names.
// ---------------------------------------------------------------------------
const WellnessPlaceholder = opensOnWeb({
  title: 'Wellness',
  blurb: 'Your daily check-in, hydration and cycle trackers, the K10 and the crisis lines.',
  path: '/wellness',
  icon: 'heart-outline',
});
const CarsPlaceholder = opensOnWeb({
  title: 'Cars',
  blurb: 'The new-car catalogue, pre-loved listings, mechanics, and your garage with its rego and service reminders.',
  path: '/cars',
  icon: 'car-outline',
});
const CarListingsPlaceholder = opensOnWeb({
  title: 'Pre-loved listings',
  blurb: 'Cars for sale from other members, with saved listings and inspections.',
  path: '/cars',
  icon: 'car-outline',
});
const FinancePlaceholder = opensOnWeb({
  title: 'Finance',
  blurb: 'Savings goals, super, your money health score and insurance.',
  path: '/finances',
  icon: 'wallet-outline',
});
const FormationPlaceholder = opensOnWeb({
  title: 'Formation',
  blurb: 'Where your ABN or company registration is up to, and the documents generated for it.',
  path: '/formation',
  icon: 'business-outline',
});
const MyPlansPlaceholder = opensOnWeb({
  title: 'My plans',
  blurb: 'The housing, business, tax and investing plans you have saved.',
  path: '/housing',
  icon: 'bookmark-outline',
});
const CalculatorPlaceholder = opensOnWeb({
  title: 'Calculators',
  blurb: 'Mortgage, borrowing power, stamp duty, tax, super and investing estimates.',
  path: '/finances',
  icon: 'calculator-outline',
});

const STRATEGY_WEB: Record<StrategyArea, { title: string; blurb: string; path: string }> = {
  HOUSING: { title: 'Housing', blurb: 'Rent or buy, borrowing power, stamp duty and a deposit plan.', path: '/housing' },
  BUSINESS: { title: 'Business', blurb: 'Structures, runway, valuation and a raise plan for your business.', path: '/business' },
  TAX: { title: 'Tax', blurb: 'An income tax estimate, deductions, super and what to set aside.', path: '/dashboard/finance/tax/plan' },
  INVESTMENT: { title: 'Investing', blurb: 'Your risk profile, an emergency fund, projections and net worth.', path: '/dashboard/finance/invest' },
};

function StrategyPlaceholder({ route }: NativeStackScreenProps<RootStackParamList, 'Strategy'>) {
  const area = route.params?.area ?? 'HOUSING';
  const copy = STRATEGY_WEB[area] ?? STRATEGY_WEB.HOUSING;
  return <OpensOnWebScreen title={copy.title} blurb={copy.blurb} path={copy.path} icon="trending-up-outline" />;
}

// Auth Stack Navigator
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </AuthStack.Navigator>
  );
}

// Main Tab Navigator
function MainNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Explore':
              iconName = focused ? 'play-circle' : 'play-circle-outline';
              break;
            case 'Jobs':
              iconName = focused ? 'briefcase' : 'briefcase-outline';
              break;
            case 'Community':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'More':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'ellipse';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#6366f1',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <MainTab.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'Feed',
          // Messages live in the root stack, so the tab's navigation prop
          // hands the tap to its parent.
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerButton}
              // getParent() is untyped on the options callback's navigation
              // prop, so the parent is named by a cast rather than a type
              // argument.
              onPress={() => (navigation.getParent() as NativeStackNavigationProp<RootStackParamList> | undefined)?.navigate('Messages')}
              accessibilityRole="button"
              accessibilityLabel="Messages"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        })}
      />
      <MainTab.Screen name="Explore" component={VideoFeedScreen} options={{ headerShown: false, title: 'Explore' }} />
      <MainTab.Screen name="Jobs" component={JobsScreen} options={{ title: 'Jobs' }} />
      <MainTab.Screen name="Community" component={ChannelsScreen} options={{ title: 'Community' }} />
      <MainTab.Screen name="More" component={MoreScreen} options={{ title: 'More' }} />
      <MainTab.Screen name="Profile" component={ProfileScreen} />
    </MainTab.Navigator>
  );
}

// Root Navigator
export function AppNavigator() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <RootStack.Screen name="Main" component={MainNavigator} />
          <RootStack.Screen
            name="JobDetail"
            component={JobDetailScreen}
            options={{ headerShown: true, title: 'Job Details' }}
          />
          <RootStack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ headerShown: true, title: 'Notifications' }}
          />
          <RootStack.Screen
            name="Messages"
            component={MessagesScreen}
            options={{ headerShown: true, title: 'Messages' }}
          />
          <RootStack.Screen
            name="ChatDetail"
            component={ChatDetailScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="VideoComments"
            component={VideoCommentsScreen}
            options={{ headerShown: true, title: 'Comments' }}
          />
          <RootStack.Screen
            name="Apprenticeships"
            component={ApprenticeshipsScreen}
            options={{ headerShown: true, title: 'Apprenticeships' }}
          />
          <RootStack.Screen
            name="SkillsMarketplace"
            component={SkillsMarketplaceScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="ServiceDetail"
            component={ServiceDetailScreen}
            options={({ route }) => ({ headerShown: true, title: route.params?.title ?? 'Service' })}
          />
          <RootStack.Screen
            name="MyOrders"
            component={MyOrdersScreen}
            options={{ headerShown: true, title: 'My orders' }}
          />
          <RootStack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ headerShown: true, title: 'Settings' }}
          />
          <RootStack.Screen
            name="ProfileEdit"
            component={ProfileEditScreen}
            options={{ headerShown: true, title: 'Edit Profile' }}
          />
          <RootStack.Screen
            name="Applications"
            component={ApplicationsScreen}
            options={{ headerShown: true, title: 'My Applications' }}
          />
          <RootStack.Screen
            name="SavedJobs"
            component={SavedJobsScreen}
            options={{ headerShown: true, title: 'Saved Jobs' }}
          />
          <RootStack.Screen
            name="HelpSupport"
            component={HelpSupportScreen}
            options={{ headerShown: true, title: 'Help & Support' }}
          />
          <RootStack.Screen name="PostComments" component={PostCommentsScreen} options={{ headerShown: true, title: 'Comments' }} />
          <RootStack.Screen name="Groups" component={GroupsScreen} options={{ headerShown: true, title: 'Groups' }} />
          <RootStack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ headerShown: true, title: 'Group' }} />
          <RootStack.Screen name="Safety" component={SafetyScreen} options={{ headerShown: true, title: 'Safety' }} />
          <RootStack.Screen name="Mentors" component={MentorsScreen} options={{ headerShown: true, title: 'Mentors' }} />
          <RootStack.Screen name="Learn" component={LearnScreen} options={{ headerShown: true, title: 'Learn' }} />
          <RootStack.Screen name="Course" component={CourseScreen} options={({ route }) => ({ headerShown: true, title: route.params?.title ?? 'Course' })} />
          <RootStack.Screen name="Upgrade" component={UpgradeScreen} options={{ headerShown: true, title: 'Membership' }} />

          {/* Pillars: placeholders until the native screens land. */}
          <RootStack.Screen name="Wellness" component={WellnessPlaceholder} options={{ headerShown: true, title: 'Wellness' }} />
          <RootStack.Screen name="WellnessCheckIn" component={WellnessPlaceholder} options={{ headerShown: true, title: 'Check in' }} />
          <RootStack.Screen name="WellnessK10" component={WellnessPlaceholder} options={{ headerShown: true, title: 'K10' }} />
          <RootStack.Screen name="Cars" component={CarsPlaceholder} options={{ headerShown: true, title: 'Cars' }} />
          <RootStack.Screen name="CarCatalogue" component={CarsPlaceholder} options={{ headerShown: true, title: 'Catalogue' }} />
          <RootStack.Screen name="CarDetail" component={CarsPlaceholder} options={({ route }) => ({ headerShown: true, title: route.params?.title ?? 'Car' })} />
          <RootStack.Screen name="CarListings" component={CarListingsPlaceholder} options={{ headerShown: true, title: 'Listings' }} />
          <RootStack.Screen name="CarListingDetail" component={CarListingsPlaceholder} options={({ route }) => ({ headerShown: true, title: route.params?.title ?? 'Listing' })} />
          <RootStack.Screen name="Strategy" component={StrategyPlaceholder} options={({ route }) => ({ headerShown: true, title: STRATEGY_WEB[route.params?.area ?? 'HOUSING']?.title ?? 'Plans' })} />
          <RootStack.Screen name="Calculator" component={CalculatorPlaceholder} options={({ route }) => ({ headerShown: true, title: route.params?.title ?? 'Calculator' })} />
          <RootStack.Screen name="MyPlans" component={MyPlansPlaceholder} options={{ headerShown: true, title: 'My plans' }} />
          <RootStack.Screen name="Finance" component={FinancePlaceholder} options={{ headerShown: true, title: 'Finance' }} />
          <RootStack.Screen name="SavingsGoal" component={FinancePlaceholder} options={{ headerShown: true, title: 'Savings goal' }} />
          <RootStack.Screen name="Formation" component={FormationPlaceholder} options={{ headerShown: true, title: 'Formation' }} />
          <RootStack.Screen name="FormationDetail" component={FormationPlaceholder} options={({ route }) => ({ headerShown: true, title: route.params?.name ?? 'Registration' })} />
        </>
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
