import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkColors, fontSize, lightColors, spacing } from '../src/theme';
import { useEntries } from '../src/useEntries';
import { buildCsvContent, formatDateHeader, formatDuration, formatTime } from '../src/utils';
import type { Entry } from '../src/types';

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    timerRef.current = setTimeout(() => setMessage(null), 1800);
  };

  return { message, show };
}

// ---------------------------------------------------------------------------
// Timeline list item types
// ---------------------------------------------------------------------------

type DateHeaderItem = { type: 'dateHeader'; date: string; key: string };
type EntryItem = { type: 'entry'; entry: Entry; duration: number; key: string };
type ListItem = DateHeaderItem | EntryItem;

function buildListItems(entries: Entry[]): ListItem[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => b.ts - a.ts);
  const items: ListItem[] = [];
  let lastDate = '';

  sorted.forEach((entry, i) => {
    const dateStr = formatDateHeader(entry.ts);
    if (dateStr !== lastDate) {
      items.push({ type: 'dateHeader', date: dateStr, key: `dh-${entry.ts}` });
      lastDate = dateStr;
    }
    const newerTs = i === 0 ? Date.now() : sorted[i - 1].ts;
    items.push({
      type: 'entry',
      entry,
      duration: newerTs - entry.ts,
      key: entry.id,
    });
  });

  return items;
}

// ---------------------------------------------------------------------------
// Edit form helpers
// ---------------------------------------------------------------------------

function formatEditDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatEditTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseEditDateTime(dateStr: string, timeStr: string): number | null {
  const dm = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!dm || !tm) return null;
  const year = parseInt(dm[1], 10);
  const month = parseInt(dm[2], 10);
  const day = parseInt(dm[3], 10);
  const hours = parseInt(tm[1], 10);
  const minutes = parseInt(tm[2], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hours > 23 || minutes > 59) return null;
  const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return isNaN(d.getTime()) ? null : d.getTime();
}

// ---------------------------------------------------------------------------
// Entry row
// ---------------------------------------------------------------------------

interface EntryRowProps {
  entry: Entry;
  duration: number;
  colors: typeof lightColors;
  onReuse: (text: string) => void;
  onEdit: (entry: Entry) => void;
  onDelete: (id: string) => void;
  onMenuOpen: (id: string, pos: { top: number; right: number }) => void;
}

function EntryRow({ entry, duration, colors, onReuse, onEdit, onDelete, onMenuOpen }: EntryRowProps) {
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < 768;
  const kebabRef = useRef<View>(null);
  const s = makeStyles(colors);

  const handleKebabPress = () => {
    kebabRef.current?.measure((_x: number, _y: number, w: number, h: number, pageX: number, pageY: number) => {
      onMenuOpen(entry.id, {
        top: pageY + h + 4,
        right: windowWidth - pageX - w,
      });
    });
  };

  return (
    <View style={s.entryRow}>
      <View style={s.dotCol}>
        <View style={s.dot} />
        <View style={s.dotLine} />
      </View>
      <View style={s.entryBody}>
        <View style={s.entryMeta}>
          <Text style={s.entryTime}>{formatTime(entry.ts)}</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>{formatDuration(duration)}</Text>
          </View>
        </View>
        <Text style={s.entryText}>{entry.text}</Text>
      </View>
      <View style={s.entryActions}>
        <Pressable
          onPress={() => onReuse(entry.text)}
          style={({ pressed }) => [s.actionBtn, pressed && s.actionBtnPressed]}
          accessibilityLabel="Reuse this entry"
        >
          <Text style={s.actionBtnText}>⤴</Text>
        </Pressable>
        {isMobile ? (
          <Pressable
            ref={kebabRef}
            onPress={handleKebabPress}
            style={({ pressed }) => [s.actionBtn, pressed && s.actionBtnPressed]}
            accessibilityLabel="More options"
          >
            <Text style={s.actionBtnText}>⋮</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={() => onEdit(entry)}
              style={({ pressed }) => [s.actionBtn, pressed && s.actionBtnPressed]}
              accessibilityLabel="Edit this entry"
            >
              <Text style={s.actionBtnText}>✏</Text>
            </Pressable>
            <Pressable
              onPress={() => onDelete(entry.id)}
              style={({ pressed }) => [s.actionBtn, s.deleteBtn, pressed && s.actionBtnPressed]}
              accessibilityLabel="Delete this entry"
            >
              <Text style={[s.actionBtnText, s.deleteBtnText]}>×</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Edit entry modal
// ---------------------------------------------------------------------------

interface EditEntryModalProps {
  entry: Entry | null;
  colors: typeof lightColors;
  onSave: (id: string, text: string, ts: number) => void;
  onCancel: () => void;
}

function EditEntryModal({ entry, colors, onSave, onCancel }: EditEntryModalProps) {
  const [text, setText] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const s = makeStyles(colors);

  useEffect(() => {
    if (entry) {
      setText(entry.text);
      setDateStr(formatEditDate(entry.ts));
      setTimeStr(formatEditTime(entry.ts));
      setError(null);
    }
  }, [entry]);

  const handleSave = () => {
    if (!entry) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Memo can't be empty");
      return;
    }
    const ts = parseEditDateTime(dateStr, timeStr);
    if (ts === null) {
      setError('Invalid date or time — use YYYY-MM-DD and HH:MM');
      return;
    }
    setError(null);
    onSave(entry.id, trimmed, ts);
  };

  return (
    <Modal visible={entry !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.modalOverlay}>
        <View style={s.modalDialog}>
          <Text style={s.modalTitle}>Edit entry</Text>

          <Text style={s.fieldLabel}>Memo</Text>
          <TextInput
            style={[s.fieldInput, s.memoInput]}
            value={text}
            onChangeText={setText}
            multiline
            placeholder="What were you doing?"
            placeholderTextColor={colors.muted}
          />

          <View style={s.fieldRow}>
            <View style={s.halfField}>
              <Text style={s.fieldLabel}>Date</Text>
              <TextInput
                style={s.fieldInput}
                value={dateStr}
                onChangeText={setDateStr}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={s.halfField}>
              <Text style={s.fieldLabel}>Time</Text>
              <TextInput
                style={s.fieldInput}
                value={timeStr}
                onChangeText={setTimeStr}
                placeholder="HH:MM"
                placeholderTextColor={colors.muted}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          {error ? <Text style={s.fieldError}>{error}</Text> : null}

          <View style={s.modalButtons}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [s.modalCancelBtn, pressed && s.modalBtnPressed]}
            >
              <Text style={s.modalCancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [s.modalSaveBtn, pressed && s.modalBtnPressed]}
            >
              <Text style={s.modalSaveBtnText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function Index() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const insets = useSafeAreaInsets();
  const s = makeStyles(colors);

  const { entries, loaded, addEntry, removeEntry, updateEntry, clearAll } = useEntries();
  const [inputText, setInputText] = useState('');
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const toast = useToast();
  const inputRef = useRef<TextInput>(null);

  const handleSubmit = () => {
    const text = inputText.trim();
    if (!text) return;
    addEntry(text);
    setInputText('');
    toast.show('Logged');
    Keyboard.dismiss();
  };

  const handleReuse = (text: string) => {
    setInputText(text);
    inputRef.current?.focus();
  };

  const handleClearAll = () => {
    if (entries.length === 0) return;
    Alert.alert(
      'Clear all entries',
      `Delete all ${entries.length} entries? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearAll();
            toast.show('Cleared');
          },
        },
      ],
    );
  };

  const handleExportCSV = async () => {
    if (entries.length === 0) {
      toast.show('Nothing to export');
      return;
    }
    const csv = buildCsvContent(entries);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `time-sighted-${dateStr}.csv`;

    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    }
    toast.show('CSV exported');
  };

  const handleMenuOpen = (id: string, pos: { top: number; right: number }) => {
    setOpenMenuId(id);
    setMenuPos(pos);
  };

  const handleMenuClose = () => {
    setOpenMenuId(null);
    setMenuPos(null);
  };

  const handleMenuEdit = () => {
    const entry = entries.find((e) => e.id === openMenuId);
    if (entry) {
      Keyboard.dismiss();
      setEditingEntry(entry);
    }
    handleMenuClose();
  };

  const handleMenuDelete = () => {
    if (openMenuId) removeEntry(openMenuId);
    handleMenuClose();
  };

  const handleDirectEdit = (entry: Entry) => {
    Keyboard.dismiss();
    setEditingEntry(entry);
  };

  const handleSaveEdit = (id: string, text: string, ts: number) => {
    updateEntry(id, { text, ts });
    setEditingEntry(null);
    toast.show('Saved');
  };

  const listItems = loaded ? buildListItems(entries) : [];

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'dateHeader') {
      return <Text style={s.dateHeader}>{item.date}</Text>;
    }
    const { entry, duration } = item;
    return (
      <EntryRow
        entry={entry}
        duration={duration}
        colors={colors}
        onReuse={handleReuse}
        onEdit={handleDirectEdit}
        onDelete={removeEntry}
        onMenuOpen={handleMenuOpen}
      />
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Time Sighted</Text>
        <View style={s.headerActions}>
          <Pressable
            onPress={handleExportCSV}
            style={({ pressed }) => [s.headerBtn, pressed && s.headerBtnPressed]}
          >
            <Text style={s.headerBtnText}>↓ CSV</Text>
          </Pressable>
          <Pressable
            onPress={handleClearAll}
            style={({ pressed }) => [s.headerBtn, pressed && s.headerBtnPressed]}
          >
            <Text style={[s.headerBtnText, s.clearBtnText]}>✕</Text>
          </Pressable>
        </View>
      </View>

      {/* Input zone */}
      <View style={s.inputZone}>
        <TextInput
          ref={inputRef}
          style={s.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="What are you switching to?"
          placeholderTextColor={colors.muted}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
          autoFocus={Platform.OS === 'web'}
        />
        <Pressable
          onPress={handleSubmit}
          style={({ pressed }) => [s.submitBtn, pressed && s.submitBtnPressed]}
          accessibilityLabel="Log entry"
        >
          <Text style={s.submitBtnText}>↵</Text>
        </Pressable>
      </View>

      {/* Timeline */}
      {loaded && entries.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>◌</Text>
          <Text style={s.emptyText}>Nothing logged yet</Text>
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Toast */}
      {toast.message && (
        <View style={[s.toast, { bottom: insets.bottom + spacing.xl }]}>
          <Text style={s.toastText}>{toast.message}</Text>
        </View>
      )}

      {/* Kebab menu overlay */}
      {openMenuId && menuPos && (
        <Modal transparent animationType="none" onRequestClose={handleMenuClose}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleMenuClose} />
          <View style={[s.kebabMenu, { top: menuPos.top, right: menuPos.right }]}>
            <Pressable
              onPress={handleMenuEdit}
              style={({ pressed }) => [s.menuItem, pressed && s.menuItemPressed]}
            >
              <Text style={s.menuItemText}>Edit</Text>
            </Pressable>
            <View style={s.menuDivider} />
            <Pressable
              onPress={handleMenuDelete}
              style={({ pressed }) => [s.menuItem, pressed && s.menuItemPressed]}
            >
              <Text style={[s.menuItemText, s.menuItemDestructive]}>Delete</Text>
            </Pressable>
          </View>
        </Modal>
      )}

      {/* Edit modal */}
      <EditEntryModal
        entry={editingEntry}
        colors={colors}
        onSave={handleSaveEdit}
        onCancel={() => setEditingEntry(null)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function makeStyles(colors: typeof lightColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      fontFamily: 'IBMPlexMono_500Medium',
      fontSize: fontSize.lg,
      color: colors.text,
      letterSpacing: 0.5,
    },
    headerActions: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    headerBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 6,
      backgroundColor: colors.buttonBg,
      minHeight: 36,
      justifyContent: 'center',
    },
    headerBtnPressed: {
      backgroundColor: colors.buttonHover,
    },
    headerBtnText: {
      fontFamily: 'IBMPlexMono_400Regular',
      fontSize: fontSize.sm,
      color: colors.muted,
    },
    clearBtnText: {
      color: colors.danger,
    },

    // Input zone
    inputZone: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    textInput: {
      flex: 1,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: fontSize.md,
      color: colors.text,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: 44,
      maxHeight: 120,
    },
    submitBtn: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    submitBtnPressed: {
      opacity: 0.8,
    },
    submitBtnText: {
      fontFamily: 'IBMPlexMono_400Regular',
      fontSize: fontSize.lg,
      color: '#ffffff',
    },

    // Timeline list
    listContent: {
      paddingTop: spacing.sm,
    },
    dateHeader: {
      fontFamily: 'IBMPlexMono_400Regular',
      fontSize: fontSize.xs,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: colors.muted,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xs,
    },
    entryRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      alignItems: 'flex-start',
    },

    // Dot column
    dotCol: {
      width: 20,
      alignItems: 'center',
      marginRight: spacing.md,
      marginTop: 4,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    dotLine: {
      width: 1,
      flex: 1,
      backgroundColor: colors.dotLine,
      marginTop: 4,
      minHeight: 24,
    },

    // Entry body
    entryBody: {
      flex: 1,
    },
    entryMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    entryTime: {
      fontFamily: 'IBMPlexMono_400Regular',
      fontSize: fontSize.sm,
      color: colors.muted,
    },
    badge: {
      backgroundColor: colors.badgeBg,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeText: {
      fontFamily: 'IBMPlexMono_400Regular',
      fontSize: fontSize.xs,
      color: colors.badgeText,
    },
    entryText: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: fontSize.md,
      color: colors.text,
      lineHeight: 22,
    },

    // Entry actions
    entryActions: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginLeft: spacing.sm,
      marginTop: 2,
    },
    actionBtn: {
      width: 32,
      height: 32,
      borderRadius: 6,
      backgroundColor: colors.buttonBg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionBtnPressed: {
      backgroundColor: colors.buttonHover,
    },
    actionBtnText: {
      fontSize: fontSize.md,
      color: colors.muted,
    },
    deleteBtn: {},
    deleteBtnText: {
      color: colors.danger,
    },

    // Empty state
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.md,
    },
    emptyIcon: {
      fontSize: 40,
      color: colors.muted,
    },
    emptyText: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: fontSize.md,
      color: colors.muted,
    },

    // Toast
    toast: {
      position: 'absolute',
      alignSelf: 'center',
      backgroundColor: colors.text,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: 20,
    },
    toastText: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: fontSize.sm,
      color: colors.background,
    },

    // Kebab dropdown menu
    kebabMenu: {
      position: 'absolute',
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      minWidth: 120,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 8,
      overflow: 'hidden',
    },
    menuItem: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    menuItemPressed: {
      backgroundColor: colors.buttonHover,
    },
    menuItemText: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: fontSize.md,
      color: colors.text,
    },
    menuItemDestructive: {
      color: colors.danger,
    },
    menuDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },

    // Edit entry modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    modalDialog: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: spacing.lg,
      width: '100%',
      maxWidth: 480,
    },
    modalTitle: {
      fontFamily: 'IBMPlexMono_500Medium',
      fontSize: fontSize.lg,
      color: colors.text,
      marginBottom: spacing.lg,
    },
    fieldLabel: {
      fontFamily: 'IBMPlexMono_400Regular',
      fontSize: fontSize.xs,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.muted,
      marginBottom: spacing.xs,
    },
    fieldInput: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: fontSize.md,
      color: colors.text,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
    },
    memoInput: {
      minHeight: 72,
      maxHeight: 120,
      textAlignVertical: 'top',
    },
    fieldRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    halfField: {
      flex: 1,
    },
    fieldError: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: fontSize.sm,
      color: colors.danger,
      marginBottom: spacing.md,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'flex-end',
      marginTop: spacing.xs,
    },
    modalCancelBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 6,
      backgroundColor: colors.buttonBg,
    },
    modalCancelBtnText: {
      fontFamily: 'IBMPlexMono_400Regular',
      fontSize: fontSize.sm,
      color: colors.muted,
    },
    modalSaveBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 6,
      backgroundColor: colors.accent,
    },
    modalSaveBtnText: {
      fontFamily: 'IBMPlexMono_400Regular',
      fontSize: fontSize.sm,
      color: '#ffffff',
    },
    modalBtnPressed: {
      opacity: 0.8,
    },
  });
}
