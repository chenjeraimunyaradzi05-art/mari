/**
 * App Navigator
 * Main navigation structure for ATHENA mobile app
 */
import React from 'react';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

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

// Parity screens
import { PostCommentsScreen } from '../screens/PostCommentsScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import { GroupDetailScreen } from '../screens/GroupDetailScreen';
import { SafetyScreen } from '../screens/SafetyScreen';
import { MentorsScreen } from '../screens/MentorsScreen';
import { LearnScreen } from '../screens/LearnScreen';
import { CourseScreen } from '../screens/CourseScreen';
import { UpgradeScreen } from '../screens/UpgradeScreen';

// Types
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  JobDetail: { jobId: string };
  ChatDetail: { conversationId: string; participantName?: string };
  VideoComments: { videoId: string; title?: string };
  Notifications: undefined;
  Apprenticeships: undefined;
  SkillsMarketplace: undefined;
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
  Profile: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

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
      <MainTab.Screen name="Home" component={HomeScreen} options={{ title: 'Feed' }} />
      <MainTab.Screen name="Explore" component={VideoFeedScreen} options={{ headerShown: false, title: 'Explore' }} />
      <MainTab.Screen name="Jobs" component={JobsScreen} options={{ title: 'Jobs' }} />
      <MainTab.Screen name="Community" component={ChannelsScreen} options={{ title: 'Community' }} />
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
});
