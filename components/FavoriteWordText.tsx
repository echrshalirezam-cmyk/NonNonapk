import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { semanticColors } from '@/constants/theme';
import { addFavoriteWord } from '@/storage/favoriteWords';

type Props = { text: string; meaning?: string; context?: string; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> };

export function FavoriteWordText({ text, meaning = '', context = '', style, textStyle }: Props) {
  const [saved, setSaved] = useState<string[]>([]);
  const parts = text.split(/([A-Za-z]+(?:['’-][A-Za-z]+)?)/g);
  return (
    <View style={[styles.wrap, style]}>
      {parts.map((part, index) => /^[A-Za-z]+(?:['’-][A-Za-z]+)?$/.test(part) ? (
        <Pressable key={index} onPress={async () => {
          try {
            await addFavoriteWord(part, meaning && parts.length === 1 ? meaning : '', context || text);
            setSaved((items) => items.includes(part.toLowerCase()) ? items : [...items, part.toLowerCase()]);
            Alert.alert('کلمه برگزیده', '«' + part + '» به کلمات برگزیده اضافه شد.');
          } catch { Alert.alert('خطا', 'ذخیره کلمه انجام نشد.'); }
        }} accessibilityRole="button" accessibilityLabel={'افزودن ' + part + ' به کلمات برگزیده'}>
          <Text style={[textStyle, styles.word]}>{part}{saved.includes(part.toLowerCase()) ? ' ★' : ''}</Text>
        </Pressable>
      ) : <Text key={index} style={textStyle}>{part}</Text>) : <Text key={index} style={textStyle}>{part}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  word: { textDecorationLine: 'underline', textDecorationColor: semanticColors.primary },
});
