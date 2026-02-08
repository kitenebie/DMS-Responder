import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, ScrollView, Modal, TextInput, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Mock Data
const MOCK_INCOMING_INCIDENT = {
  id: "INC-2024-0847",
  type: "Medical Emergency",
  location: "1247 Oak Street, Downtown",
  coordinates: { lat: 40.7128, lng: -74.006 },
  timeReported: new Date().toISOString(),
  description: "Elderly person collapsed. Possible cardiac event. Bystander performing CPR.",
  priority: "High",
  caller: "John Smith",
  callerPhone: "(555) 123-4567",
};

const MOCK_HISTORICAL_INCIDENTS = [
  {
    id: "INC-2024-0846",
    type: "Traffic Accident",
    location: "789 Highway 101, Exit 23",
    timeReported: "2024-01-15T14:30:00Z",
    status: "Completed",
    responder: "Unit 12",
    description: "Minor fender bender, no injuries",
  },
  // ... other incidents
];

const MOCK_CHAT_MESSAGES = [
  {
    id: 1,
    sender: "Dispatch",
    message: "Unit 12, please confirm your status.",
    time: "14:32",
    isUser: false,
  },
  // ... other messages
];

const STATUS_FLOW = ["Ongoing", "Arrived", "Duplicate", "Cancelled", "Completed"];

const STATUS_COLORS = {
  Pending: "bg-gray-500",
  Ongoing: "bg-blue-500",
  Arrived: "bg-green-500",
  Completed: "bg-emerald-500",
  Cancelled: "bg-red-500",
  Duplicate: "bg-orange-500",
};

const defaultConfig = {
  app_title: "Responder",
  responder_name: "Unit 12",
  primary_color: "#3B82F6",
  secondary_color: "#1E293B",
  accent_color: "#10B981",
  text_color: "#F8FAFC",
  background_color: "#0F172A",
};

const themes = {
  dark: {
    background: "#0F172A",
    surface: "#1E293B",
    surfaceAlt: "#334155",
    text: "#F8FAFC",
    textSecondary: "#94A3B8",
    border: "#334155",
    mapBg: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  },
  light: {
    background: "#F8FAFC",
    surface: "#FFFFFF",
    surfaceAlt: "#E2E8F0",
    text: "#0F172A",
    textSecondary: "#475569",
    border: "#CBD5E1",
    mapBg: "linear-gradient(135deg, #E0E7FF 0%, #DBEAFE 50%, #BFDBFE 100%)",
  },
};

// Helper Functions
function formatTime(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type ScreenContentProps = {
  title: string;
  path: string;
  children?: React.ReactNode;
};

export const ScreenContent = ({ title, path, children }: ScreenContentProps) => {
  const [state, setState] = useState({
    showIncomingModal: true,
    activeIncident: null as any,
    currentStatus: "Pending",
    isMapFullscreen: false,
    showChat: false,
    showHistory: false,
    isDarkMode: true,
    chatMessages: [...MOCK_CHAT_MESSAGES],
    newMessage: "",
    historySearch: "",
    historyFilter: { type: "all", status: "all" },
    reportForm: {
      actionsTaken: "",
      timeArrived: "",
      timeCompleted: "",
      additionalNotes: "",
    },
  });

  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (state.showIncomingModal) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [state.showIncomingModal]);

  const getTheme = () => state.isDarkMode ? themes.dark : themes.light;

  // Event Handlers
  const acceptIncident = () => {
    setState(prev => ({ ...prev, showIncomingModal: false, activeIncident: { ...MOCK_INCOMING_INCIDENT } }));
  };

  const dismissIncident = () => {
    setState(prev => ({ ...prev, showIncomingModal: false }));
  };

  const updateStatus = (newStatus: string) => {
    setState(prev => ({ ...prev, currentStatus: newStatus }));
  };

  const toggleMapFullscreen = () => {
    setState(prev => ({ ...prev, isMapFullscreen: !prev.isMapFullscreen }));
  };

  const toggleChat = () => {
    setState(prev => ({ ...prev, showChat: !prev.showChat }));
  };

  const toggleHistory = () => {
    setState(prev => ({ ...prev, showHistory: !prev.showHistory }));
  };

  const toggleTheme = () => {
    setState(prev => ({ ...prev, isDarkMode: !prev.isDarkMode }));
  };

  const sendMessage = () => {
    if (state.newMessage.trim()) {
      setState(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, {
          id: prev.chatMessages.length + 1,
          sender: defaultConfig.responder_name,
          message: prev.newMessage,
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          isUser: true,
        }],
        newMessage: "",
      }));
    }
  };

  const updateReportForm = (field: string, value: string) => {
    setState(prev => ({
      ...prev,
      reportForm: { ...prev.reportForm, [field]: value },
    }));
  };

  const submitReport = () => {
    Alert.alert("Report submitted successfully!");
  };

  const filterHistory = () => {
    let filtered = [...MOCK_HISTORICAL_INCIDENTS];
    if (state.historySearch) {
      const search = state.historySearch.toLowerCase();
      filtered = filtered.filter(inc =>
        inc.id.toLowerCase().includes(search) ||
        inc.type.toLowerCase().includes(search) ||
        inc.location.toLowerCase().includes(search) ||
        inc.description.toLowerCase().includes(search)
      );
    }
    if (state.historyFilter.type !== "all") {
      filtered = filtered.filter(inc => inc.type === state.historyFilter.type);
    }
    if (state.historyFilter.status !== "all") {
      filtered = filtered.filter(inc => inc.status === state.historyFilter.status);
    }
    return filtered;
  };

  const theme = getTheme();

  if (state.isMapFullscreen) {
    return (
      <SafeAreaView className="h-full w-full bg-slate-900">
        {/* Fullscreen Map - simplified */}
        <View className="h-full w-full bg-gradient-to-br from-slate-800 to-slate-900 relative">
          <TouchableOpacity onPress={toggleMapFullscreen} className="absolute top-4 right-4 w-10 h-10 bg-slate-700 rounded-lg items-center justify-center">
            <Text className="text-white">X</Text>
          </TouchableOpacity>
          <View className="absolute inset-0 items-center justify-center">
            <Text className="text-white">Map View</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="h-full w-full flex flex-col bg-slate-900 text-white">
      {/* Header */}
      <View className="flex-shrink-0 px-4 py-3 bg-slate-800 border-b border-slate-700">
        <View className="flex flex-row items-center justify-between">
          <View className="flex flex-row items-center gap-3">
            <View className="w-10 h-10 bg-blue-600 rounded-xl items-center justify-center">
              <Text className="text-white text-lg">★</Text>
            </View>
            <View>
              <Text className="font-bold text-lg text-white">{defaultConfig.app_title}</Text>
              <Text className="text-xs text-gray-400">{defaultConfig.responder_name}</Text>
            </View>
          </View>
          <View className="flex flex-row items-center gap-2">
            <TouchableOpacity onPress={toggleTheme} className="w-10 h-10 bg-slate-700 rounded-lg items-center justify-center">
              <Text className="text-white">{state.isDarkMode ? "☀" : "🌙"}</Text>
            </TouchableOpacity>
            {state.activeIncident ? (
              <View className={`px-3 py-1 rounded-full ${STATUS_COLORS[state.currentStatus as keyof typeof STATUS_COLORS]}`}>
                <Text className="text-xs font-bold text-white">{state.currentStatus}</Text>
              </View>
            ) : (
              <View className="px-3 py-1 rounded-full bg-slate-700">
                <Text className="text-xs font-bold text-white">Available</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView className="flex-1 p-4 space-y-4">
        {/* Map */}
        <View className="h-64 w-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg relative overflow-hidden">
          <TouchableOpacity onPress={toggleMapFullscreen} className="absolute bottom-4 right-4 w-10 h-10 bg-slate-700 rounded-lg items-center justify-center">
            <Text className="text-white">⛶</Text>
          </TouchableOpacity>
          {state.activeIncident && (
            <View className="absolute bottom-12 left-4 bg-slate-700 px-3 py-2 rounded-lg">
              <Text className="text-white text-sm">{state.activeIncident.location}</Text>
            </View>
          )}
        </View>

        {/* Incident Details */}
        {state.activeIncident && (
          <View className="rounded-xl p-4 bg-slate-800 border border-slate-700">
            <Text className="text-lg font-bold mb-4 text-white">Active</Text>
            <View className="grid grid-cols-2 gap-3">
              <View className="rounded-lg p-3 bg-slate-700">
                <Text className="text-xs mb-1 text-gray-400">Incident ID</Text>
                <Text className="font-medium text-white">{state.activeIncident.id}</Text>
              </View>
              <View className="rounded-lg p-3 bg-slate-700">
                <Text className="text-xs mb-1 text-gray-400">Type</Text>
                <Text className="font-medium text-white">{state.activeIncident.type}</Text>
              </View>
              <View className="rounded-lg p-3 bg-slate-700 col-span-2">
                <Text className="text-xs mb-1 text-gray-400">Location</Text>
                <Text className="font-medium text-white">{state.activeIncident.location}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Status Tracker */}
        {state.activeIncident && (
          <View className="rounded-xl p-4 bg-slate-800 border border-slate-700">
            <Text className="text-lg font-bold mb-6 text-white">Status Timeline</Text>
            <View className="relative">
              <View className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-700"></View>
              {STATUS_FLOW.map((status, index) => {
                const isActive = state.currentStatus === status;
                const isPassed = STATUS_FLOW.indexOf(state.currentStatus) > index;
                const colorClass = STATUS_COLORS[status as keyof typeof STATUS_COLORS];
                const isLeft = index % 2 === 0;
                return (
                  <View key={status} className={`relative flex ${isLeft ? 'flex-row' : 'flex-row-reverse'} items-center gap-4 mb-8`}>
                    <TouchableOpacity onPress={() => updateStatus(status)} className={`w-1/2 rounded-lg px-4 py-3 ${isActive ? 'ring-2 ring-blue-500' : ''} bg-slate-700`}>
                      <View className={`flex ${isLeft ? 'justify-end' : 'justify-start'} gap-3`}>
                        <View>
                          <Text className={`font-semibold ${isActive ? 'text-lg' : 'text-base'} text-white`}>{status}</Text>
                          <Text className="text-xs text-gray-400">
                            {isPassed ? "Completed" : isActive ? "Current Status" : "Pending"}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => updateStatus(status)} className={`w-10 h-10 rounded-full items-center justify-center ${isActive ? 'scale-125' : ''} ${colorClass}`}>
                      <Text className="text-white text-xs">{isPassed ? "✓" : isActive ? "●" : ""}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Responder Report */}
        {state.currentStatus === "Completed" && state.activeIncident && (
          <View className="bg-slate-800 rounded-xl p-4 border border-emerald-600">
            <Text className="text-lg font-bold mb-4 text-white">Responder Incident Report</Text>
            <View className="space-y-4">
              <View>
                <Text className="text-sm text-gray-400 mb-2">Actions Taken</Text>
                <TextInput
                  placeholder="Describe actions taken..."
                  value={state.reportForm.actionsTaken}
                  onChangeText={(value) => updateReportForm('actionsTaken', value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white"
                  multiline
                  numberOfLines={3}
                />
              </View>
              <View className="flex flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-sm text-gray-400 mb-2">Time Arrived</Text>
                  <TextInput
                    placeholder="HH:MM"
                    value={state.reportForm.timeArrived}
                    onChangeText={(value) => updateReportForm('timeArrived', value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-gray-400 mb-2">Time Completed</Text>
                  <TextInput
                    placeholder="HH:MM"
                    value={state.reportForm.timeCompleted}
                    onChangeText={(value) => updateReportForm('timeCompleted', value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white"
                  />
                </View>
              </View>
              <View>
                <Text className="text-sm text-gray-400 mb-2">Additional Notes</Text>
                <TextInput
                  placeholder="Any additional observations..."
                  value={state.reportForm.additionalNotes}
                  onChangeText={(value) => updateReportForm('additionalNotes', value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white"
                  multiline
                  numberOfLines={2}
                />
              </View>
              <TouchableOpacity onPress={submitReport} className="w-full py-3 bg-emerald-600 rounded-xl items-center justify-center">
                <Text className="text-white font-bold">Submit Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Action Bar */}
        <View className="flex flex-row gap-2 mt-4">
          <TouchableOpacity onPress={toggleChat} className="flex-1 py-3 bg-blue-600 rounded-xl items-center justify-center">
            <Text className="text-white font-semibold">Open Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleHistory} className="flex-1 py-3 bg-purple-600 rounded-xl items-center justify-center">
            <Text className="text-white font-semibold">History</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Incoming Modal */}
      <Modal visible={state.showIncomingModal} transparent animationType="none">
        <Animated.View style={{ opacity: fadeAnim }} className="flex-1 bg-black/70 items-center justify-center p-4">
          <View className="bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-slate-700">
            <View className="bg-red-600 px-6 py-4 rounded-t-2xl">
              <Text className="text-xl font-bold text-white">Incoming Incident Report</Text>
              <Text className="text-red-100 text-sm">Priority: {MOCK_INCOMING_INCIDENT.priority}</Text>
            </View>
            <View className="p-6 space-y-4">
              <View className="bg-slate-700 p-4 rounded-xl">
                <Text className="text-gray-400 text-sm mb-2">Incident ID</Text>
                <Text className="text-white font-semibold">{MOCK_INCOMING_INCIDENT.id}</Text>
              </View>
              <View className="grid grid-cols-2 gap-4">
                <View className="bg-slate-700 p-4 rounded-xl">
                  <Text className="text-gray-400 text-sm mb-2">Type</Text>
                  <Text className="text-white font-semibold text-sm">{MOCK_INCOMING_INCIDENT.type}</Text>
                </View>
                <View className="bg-slate-700 p-4 rounded-xl">
                  <Text className="text-gray-400 text-sm mb-2">Time</Text>
                  <Text className="text-white font-semibold text-sm">{formatTime(MOCK_INCOMING_INCIDENT.timeReported)}</Text>
                </View>
              </View>
              <View className="bg-slate-700 p-4 rounded-xl">
                <Text className="text-gray-400 text-sm mb-2">Location</Text>
                <Text className="text-white font-semibold">{MOCK_INCOMING_INCIDENT.location}</Text>
              </View>
              <View className="bg-slate-700 p-4 rounded-xl">
                <Text className="text-gray-400 text-sm mb-2">Description</Text>
                <Text className="text-white text-sm">{MOCK_INCOMING_INCIDENT.description}</Text>
              </View>
            </View>
            <View className="px-6 pb-6 flex flex-row gap-3">
              <TouchableOpacity onPress={dismissIncident} className="flex-1 py-3 px-4 bg-slate-600 rounded-xl items-center justify-center">
                <Text className="text-white font-semibold">Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={acceptIncident} className="flex-1 py-3 px-4 bg-blue-600 rounded-xl items-center justify-center">
                <Text className="text-white font-semibold">Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Modal>

      {/* Chat Modal */}
      <Modal visible={state.showChat} transparent animationType="slide">
        <View className="flex-1 bg-black/50 items-end justify-center p-4">
          <View className="bg-slate-800 rounded-t-2xl w-full max-w-md shadow-2xl border border-slate-700 max-h-4/5 flex flex-col">
            <View className="bg-slate-700 px-6 py-4 rounded-t-2xl flex flex-row items-center justify-between">
              <View className="flex flex-row items-center gap-3">
                <View className="w-10 h-10 bg-blue-600 rounded-full items-center justify-center">
                  <Text className="text-white">💬</Text>
                </View>
                <View>
                  <Text className="font-bold text-white">Dispatch Chat</Text>
                  <Text className="text-xs text-gray-400">Connected</Text>
                </View>
              </View>
              <TouchableOpacity onPress={toggleChat} className="w-8 h-8 bg-slate-600 rounded-full items-center justify-center">
                <Text className="text-white">✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView className="flex-1 p-4 space-y-3">
              {state.chatMessages.map((msg) => (
                <View key={msg.id} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                  <View className={`${msg.isUser ? 'bg-blue-600' : 'bg-slate-700'} rounded-2xl px-4 py-2 max-w-4/5`}>
                    {!msg.isUser && <Text className="text-xs text-gray-400 mb-1">{msg.sender}</Text>}
                    <Text className="text-sm text-white">{msg.message}</Text>
                    <Text className={`text-xs mt-1 text-right ${msg.isUser ? 'text-blue-200' : 'text-gray-500'}`}>{msg.time}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View className="p-4 border-t border-slate-700 flex flex-row gap-2">
              <TextInput
                placeholder="Type a message..."
                value={state.newMessage}
                onChangeText={(value) => setState(prev => ({ ...prev, newMessage: value }))}
                className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white"
                onSubmitEditing={sendMessage}
              />
              <TouchableOpacity onPress={sendMessage} className="w-12 h-12 bg-blue-600 rounded-xl items-center justify-center">
                <Text className="text-white">➤</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal visible={state.showHistory} transparent animationType="fade">
        <View className="flex-1 bg-black/70 items-center justify-center p-4">
          <View className="bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-700 max-h-5/6 flex flex-col">
            <View className="bg-slate-700 px-6 py-4 rounded-t-2xl flex flex-row items-center justify-between">
              <View className="flex flex-row items-center gap-3">
                <View className="w-10 h-10 bg-purple-600 rounded-full items-center justify-center">
                  <Text className="text-white">📅</Text>
                </View>
                <View>
                  <Text className="font-bold text-white">Incident History</Text>
                  <Text className="text-xs text-gray-400">{filterHistory().length} records</Text>
                </View>
              </View>
              <TouchableOpacity onPress={toggleHistory} className="w-8 h-8 bg-slate-600 rounded-full items-center justify-center">
                <Text className="text-white">✕</Text>
              </TouchableOpacity>
            </View>
            <View className="p-4 border-b border-slate-700 space-y-3">
              <View className="relative">
                <TextInput
                  placeholder="Search incidents..."
                  value={state.historySearch}
                  onChangeText={(value) => setState(prev => ({ ...prev, historySearch: value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl pl-10 pr-4 py-3 text-white"
                />
              </View>
              <View className="flex flex-row gap-2">
                <View className="flex-1">
                  <TextInput
                    placeholder="All Types"
                    value={state.historyFilter.type}
                    onChangeText={(value) => setState(prev => ({ ...prev, historyFilter: { ...prev.historyFilter, type: value } }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </View>
                <View className="flex-1">
                  <TextInput
                    placeholder="All Statuses"
                    value={state.historyFilter.status}
                    onChangeText={(value) => setState(prev => ({ ...prev, historyFilter: { ...prev.historyFilter, status: value } }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </View>
              </View>
            </View>
            <ScrollView className="flex-1 p-4 space-y-3">
              {filterHistory().map((incident) => (
                <View key={incident.id} className="bg-slate-700 p-4 rounded-xl border border-slate-600">
                  <View className="flex flex-row items-start justify-between mb-2">
                    <View>
                      <Text className="font-semibold text-white">{incident.id}</Text>
                      <Text className="text-sm text-gray-400">{incident.type}</Text>
                    </View>
                    <View className={`px-2 py-1 rounded-full ${STATUS_COLORS[incident.status as keyof typeof STATUS_COLORS]}`}>
                      <Text className="text-xs font-bold text-white">{incident.status}</Text>
                    </View>
                  </View>
                  <Text className="text-sm text-gray-300 mb-2">{incident.location}</Text>
                  <Text className="text-xs text-gray-500">{formatDate(incident.timeReported)} at {formatTime(incident.timeReported)}</Text>
                  <Text className="text-xs text-gray-400 mt-2">{incident.description}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};
