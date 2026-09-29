/**
 * App Navigator
 * Main navigation structure for ATHENA mobile app
 *
 * The bottom bar is Feed / Explore / Jobs / Community / More / Profile. More
 * is the hub for every pillar (wellness, cars, the money plans, finance,
 * formation, the marketplace, apprenticeships, messages) and for the rows
 * that used to sit on Profile; Profile keeps identity and settings.
 *
 * Every pillar route is a native screen. They were registered for a long
 * time against a single "opens on the web" card, which made most of the
 * super app a link out; the parts of each pillar that still live on the web
 * (paying for a car, a registration's fee, the practitioner directory) are
 * rows inside the native screens that say so before they are tapped.
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

// Pillars
import { WellnessScreen } from '../screens/wellness/WellnessScreen';
import { WellnessCheckInScreen } from '../screens/wellness/WellnessCheckInScreen';
import { WellnessK10Screen } from '../screens/wellness/WellnessK10Screen';
import { CarsScreen } from '../screens/cars/CarsScreen';
import { CarCatalogueScreen } from '../screens/cars/CarCatalogueScreen';
import { CarDetailScreen } from '../screens/cars/CarDetailScreen';
import { CarListingsScreen } from '../screens/cars/CarListingsScreen';
import { CarListingDetailScreen } from '../screens/cars/CarListingDetailScreen';
import { StrategyScreen } from '../screens/money/StrategyScreen';
import { CalculatorScreen } from '../screens/money/CalculatorScreen';
import { MyPlansScreen } from '../screens/money/MyPlansScreen';
import { FinanceScreen } from '../screens/money/FinanceScreen';
import { SavingsGoalScreen } from '../screens/money/SavingsGoalScreen';
import { FormationScreen } from '../screens/money/FormationScreen';
import { FormationDetailScreen } from '../screens/money/FormationDetailScreen';
import { QuickExitButton } from '../components/pillar/QuickExit';
import type { StrategyArea } from '../services/money';

export type { StrategyArea };

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
  // Pillars.
  Wellness: undefined;
  WellnessCheckIn: undefined;
  WellnessK10: undefined;
  Cars: undefined;
  CarCatalogue: undefined;
  CarDetail: { slug: string; title?: string };
  CarListings: { saved?: boolean } | undefined;
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

/** Titles for the four money plans, for the Strategy header. */
const STRATEGY_TITLES: Record<StrategyArea, string> = { HOUSING: 'Housing', BUSINESS: 'Business', TAX: 'Tax', INVESTMENT: 'Investing' };

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

          {/* Pillars. The wellness screens carry the quick exit the web's wellness pages do. */}
          <RootStack.Screen name="Wellness" component={WellnessScreen} options={{ headerShown: true, title: 'Wellness', headerRight: () => <QuickExitButton /> }} />
          <RootStack.Screen name="WellnessCheckIn" component={WellnessCheckInScreen} options={{ headerShown: true, title: 'Check in', headerRight: () => <QuickExitButton /> }} />
          <RootStack.Screen name="WellnessK10" component={WellnessK10Screen} options={{ headerShown: true, title: 'The last four weeks', headerRight: () => <QuickExitButton /> }} />
          <RootStack.Screen name="Cars" component={CarsScreen} options={{ headerShown: true, title: 'Cars' }} />
          <RootStack.Screen name="CarCatalogue" component={CarCatalogueScreen} options={{ headerShown: true, title: 'New cars' }} />
          <RootStack.Screen name="CarDetail" component={CarDetailScreen} options={({ route }) => ({ headerShown: true, title: route.params?.title ?? 'Car' })} />
          <RootStack.Screen name="CarListings" component={CarListingsScreen} options={({ route }) => ({ headerShown: true, title: route.params?.saved ? 'Saved listings' : 'Pre-loved' })} />
          <RootStack.Screen name="CarListingDetail" component={CarListingDetailScreen} options={({ route }) => ({ headerShown: true, title: route.params?.title ?? 'Listing' })} />
          <RootStack.Screen name="Strategy" component={StrategyScreen} options={({ route }) => ({ headerShown: true, title: STRATEGY_TITLES[route.params?.area ?? 'HOUSING'] ?? 'Plans' })} />
          <RootStack.Screen name="Calculator" component={CalculatorScreen} options={({ route }) => ({ headerShown: true, title: route.params?.title ?? 'Calculator' })} />
          <RootStack.Screen name="MyPlans" component={MyPlansScreen} options={{ headerShown: true, title: 'My plans' }} />
          <RootStack.Screen name="Finance" component={FinanceScreen} options={{ headerShown: true, title: 'Finance' }} />
          <RootStack.Screen name="SavingsGoal" component={SavingsGoalScreen} options={({ route }) => ({ headerShown: true, title: route.params?.goalId ? 'Savings goal' : 'A new goal' })} />
          <RootStack.Screen name="Formation" component={FormationScreen} options={{ headerShown: true, title: 'Formation' }} />
          <RootStack.Screen name="FormationDetail" component={FormationDetailScreen} options={({ route }) => ({ headerShown: true, title: route.params?.name ?? 'Registration' })} />
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
