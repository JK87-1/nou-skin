import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { getRecords, getSmoothedChanges, getChanges, getLatestRecord, getStableSkinAge, getRecentTrend } from '../storage/SkinStorage';
import { getProfile } from '../storage/ProfileStorage';
import { compressImage } from '../engine/PixelAnalysis';
import { getProductsWithUsageContext, getRoutineSnapshot, getProducts, saveProduct as saveTrackerProduct, dedupeProductsByName } from '../storage/TrackerStorage';
import { saveConsultSession, loadConsultSession, clearConsultSession, purgeLegacyConsultSession } from '../storage/ConsultStorage';
import { buildRoutineRecommendation, serializeRoutineForPrompt, detectInteractions, serializeInteractionsForPrompt } from '../utils/routineBuilder';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { getMemoryContext, recordUserMessage } from '../storage/UserMemoryStorage';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { getActivePersonaId, setActivePersonaId } from '../storage/PersonaStorage';
import { getPersonaById, PERSONAS } from '../data/PersonaCatalog';
import PersonaPicker from './PersonaPicker';

function getGreetingMsg() {
  return '안녕하세요, 당신의 피부 상담사 루아에요. 궁금한 점이 있으면 편하게 물어보세요!';
}

// 빈 채팅 진입 시 중앙 큰 문구 — 페르소나·시간대 기반 + 랜덤. Gemini 톤.
function pickEmptyPrompt(personaId) {
  const hour = new Date().getHours();
  const isMorning = hour >= 5 && hour < 11;
  const isAfternoon = hour >= 11 && hour < 17;
  const isEvening = hour >= 17 && hour < 22;
  const isLateNight = hour >= 22 || hour < 5;

  const CARE = [
    '오늘 피부는 어떤가요?',
    '편하게 얘기해 주세요',
    '오늘 컨디션 어때요?',
    isMorning ? '오늘 아침 피부 어때요?' : null,
    isEvening ? '오늘 하루 피부는요?' : null,
    isLateNight ? '잠들기 전, 마음 쓰이는 부분 있어요?' : null,
    '요즘 신경 쓰이는 부분 있어요?',
    '오늘 어떤 게 가장 궁금해요?',
    '루틴 짜는 거 도와드릴까요?',
  ];
  const CLINIC = [
    '어떤 부분을 진료해드릴까요?',
    '오늘 정밀 분석이 필요한 부분이 있나요?',
    '진단이 필요하신 증상이 있으세요?',
    isMorning ? '아침 피부 상태에 대해 진료받고 싶은 부분이 있나요?' : null,
    isEvening ? '오늘 저녁 어떤 부분을 진료해드릴까요?' : null,
    '측정 결과 중 자세히 알고 싶은 항목이 있나요?',
    '성분·기전 관련 궁금한 게 있으세요?',
  ];
  const CONCIERGE = [
    '오늘 어떤 인사이트를 도와드릴까요?',
    '등록 제품과 측정 데이터를 종합해드릴게요',
    '오늘 가장 궁금한 부분이 있나요?',
    isMorning ? '오늘 아침 루틴, 어떻게 짜드릴까요?' : null,
    isEvening ? '저녁 루틴 점검해드릴까요?' : null,
    '맞춤 루틴이 필요하신가요?',
    '제품 라인업 최적화가 필요하시면 말씀해주세요',
  ];

  const pool = (personaId === 'clinic' ? CLINIC : personaId === 'concierge' ? CONCIERGE : CARE).filter(Boolean);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ===== AI 응답에서 [APPLY_ROUTINE] JSON 블록 추출 =====
const TRACKER_CATEGORY_SET = new Set(['클렌저','토너','에센스','세럼','크림','선크림','마스크팩','기타']);
function extractApplyRoutine(text) {
  if (!text) return { cleanText: text, routine: null };
  // 시작 태그 변형·truncate 흡수 — `[APPLY_ROUT`, `[APPLY_ROUTINE`, `[APPLY_ROUTINE]` 모두 매칭.
  // 모델이 토큰 한도로 끊겼거나 시작 태그가 깨져 들어와도 raw 마커가 본문에 노출되지 않게.
  const startRe = /\[APPLY_ROUT(?:INE)?\]?/i;
  const startMatch = text.match(startRe);
  if (!startMatch) return { cleanText: text, routine: null };
  const startIdx = startMatch.index;
  const startLen = startMatch[0].length;

  const endRe = /\[\/APPLY_ROUTINE\]/i;
  const tailSearch = text.slice(startIdx).match(endRe);
  const endIdx = tailSearch ? startIdx + tailSearch.index : -1;
  const endLen = tailSearch ? tailSearch[0].length : 0;

  const head = text.slice(0, startIdx).trim();
  const tail = endIdx !== -1 ? text.slice(endIdx + endLen).trim() : '';
  const cleanText = tail ? `${head}\n\n${tail}` : head;

  // 시작 태그가 정확히 `[APPLY_ROUTINE]`이고 닫는 태그까지 모두 있을 때만 JSON 파싱 시도
  if (endIdx === -1 || !/^\[APPLY_ROUTINE\]$/i.test(startMatch[0])) {
    return { cleanText, routine: null };
  }
  const jsonStr = text.slice(startIdx + startLen, endIdx).trim();
  let parsed = null;
  try { parsed = JSON.parse(jsonStr); } catch { parsed = null; }
  if (!parsed || typeof parsed !== 'object') return { cleanText, routine: null };

  const sanitize = (arr) => Array.isArray(arr) ? arr
    .filter(x => x && typeof x === 'object' && typeof x.name === 'string' && x.name.trim())
    .map(x => ({
      name: String(x.name).trim().slice(0, 60),
      brand: typeof x.brand === 'string' ? x.brand.trim().slice(0, 40) : '',
      category: TRACKER_CATEGORY_SET.has(x.category) ? x.category : '기타',
      timeSlot: ['morning','night','both'].includes(x.timeSlot) ? x.timeSlot : 'both',
      ingredients: typeof x.ingredients === 'string' ? x.ingredients.trim().slice(0, 120) : '',
    }))
    .slice(0, 12)
    : [];

  const morning = sanitize(parsed.morning);
  const night = sanitize(parsed.night);
  if (morning.length === 0 && night.length === 0) return { cleanText, routine: null };
  return { cleanText, routine: { morning, night } };
}

// ===== AI 응답에서 [QUICK_REPLY] chip 옵션 추출 =====
// 형식: [QUICK_REPLY]옵션1|옵션2|옵션3[/QUICK_REPLY]
// 본문에서 마커를 제거하고 옵션 배열 반환. 시작 태그만 와도 본문에서 잘라내서 raw 노출 차단.
function extractQuickReply(text) {
  if (!text) return { cleanText: text, quickReplies: null };
  // 시작 태그 변형·truncate 흡수 — `[QUICK_REPL`, `[QUICK_REPLY`, `[QUICK_REPLY]` 모두 매칭.
  const startRe = /\[QUICK_REPL(?:Y)?\]?/i;
  const startMatch = text.match(startRe);
  if (!startMatch) return { cleanText: text, quickReplies: null };
  const startIdx = startMatch.index;
  const startLen = startMatch[0].length;

  const endRe = /\[\/QUICK_REPLY\]/i;
  const tailSearch = text.slice(startIdx).match(endRe);
  const endIdx = tailSearch ? startIdx + tailSearch.index : -1;
  const endLen = tailSearch ? tailSearch[0].length : 0;

  const head = text.slice(0, startIdx).trim();
  const tail = endIdx !== -1 ? text.slice(endIdx + endLen).trim() : '';
  const cleanText = (tail ? `${head}\n\n${tail}` : head).replace(/\n{3,}/g, '\n\n').trim();

  if (endIdx === -1 || !/^\[QUICK_REPLY\]$/i.test(startMatch[0])) {
    return { cleanText, quickReplies: null };
  }
  const raw = text.slice(startIdx + startLen, endIdx);
  const options = raw.split('|')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => s.length <= 30)
    .slice(0, 5);
  if (options.length === 0) return { cleanText, quickReplies: null };
  return { cleanText, quickReplies: options };
}

// 같은 제품(name+brand 일치)이 이미 등록됐는지 체크 — TrackerStorage.normKey와 동일 규칙.
// name이 brand로 시작하면 prefix 제거 후 비교 (AI 추천이 "토리든 토리든 …" 같이 중복 prefix 보내도 대응).
function findExistingTrackerProduct(existing, item) {
  const stripBrand = (brand, name) => {
    if (!name || !brand) return name || '';
    const n = name.trim();
    const b = brand.trim();
    if (n.toLowerCase().startsWith(b.toLowerCase())) {
      const rest = n.slice(b.length).trim();
      if (rest) return rest;
    }
    return n;
  };
  const norm = (s) => (s || '').replace(/[\s\-_·.,+/\\()\[\]{}!?'"`~@#$%^&*=:;]+/g, '').toLowerCase();
  const keyOf = (brand, name) => norm(brand) + '|' + norm(stripBrand(brand, name));
  const itemKey = keyOf(item.brand, item.name);
  return existing.find(p => keyOf(p.brand, p.name) === itemKey);
}

// 메시지별 무거운 작업(regex 추출 + 마크다운)을 격리하고 React.memo로 재렌더 차단.
// 마지막 메시지(content/isLast/isLoading 변경)만 재렌더, 과거 메시지는 props 안 바뀌어 skip.
const LuaAssistantMessage = memo(function LuaAssistantMessage({
  content, isLast, isLoading,
  messageKey, isApplied,
  onApplyRoutine, onSendQuickReply, onRegen, onCopy,
}) {
  const { cleanText, routine, quickReplies } = useMemo(() => {
    const ar = extractApplyRoutine(content);
    const qr = extractQuickReply(ar.cleanText);
    return { cleanText: qr.cleanText, routine: ar.routine, quickReplies: qr.quickReplies };
  }, [content]);

  const showQuickReplies = isLast && !isLoading && quickReplies && quickReplies.length > 0;
  const showActions = !isLoading || !isLast;

  return (
    <div style={{ padding: '10px 2px 4px', fontSize: 16, animation: 'luaMsgFadeIn 0.32s cubic-bezier(0.22, 0.84, 0.36, 1)' }}>
      <style>{`@keyframes luaMsgFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {renderChatMarkdown(cleanText)}
      {routine && (
        <ApplyRoutineCard
          routine={routine}
          applied={isApplied}
          onApply={() => onApplyRoutine(messageKey, routine)}
        />
      )}
      {showQuickReplies && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8,
          marginTop: 14, paddingTop: 2,
          animation: 'luaChipFadeIn 0.28s ease both',
        }}>
          <style>{`@keyframes luaChipFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          {quickReplies.map((opt, qi) => (
            <button
              key={qi}
              type="button"
              className="gem-btn"
              onClick={() => onSendQuickReply(opt)}
              style={{
                padding: '9px 14px',
                borderRadius: 18,
                border: '1px solid rgba(101,152,239,0.32)',
                background: 'rgba(101,152,239,0.08)',
                color: '#1F1F1F',
                fontSize: 14, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
                letterSpacing: -0.1,
                maxWidth: '100%',
                textAlign: 'left',
                lineHeight: 1.35,
              }}
            >{opt}</button>
          ))}
        </div>
      )}
      {showActions && (
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 14, paddingTop: 2 }}>
          <button className="gem-act" aria-label="좋아요" onClick={() => {}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7l-3-3v-9a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>
          </button>
          <button className="gem-act" aria-label="별로예요" onClick={() => {}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17l3 3v9a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>
          </button>
          <button className="gem-act" aria-label="다시 답변" onClick={onRegen}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
          </button>
          <button className="gem-act" aria-label="복사" onClick={() => onCopy(content)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>
      )}
    </div>
  );
});

function formatTime(ts) {
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${h === 0 ? 12 : h > 12 ? h - 12 : h}:${m}`;
}

// Star icon SVG (same as FAB — glassmorphism + depth)
function StarIcon({ size = 14 }) {
  const id = `chat-star-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 642.82 626.11" style={{ filter: 'drop-shadow(0 1px 2px rgba(100,180,230,0.5))' }}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
          <stop offset="0%" stopColor="#D6EEFB" />
          <stop offset="45%" stopColor="#a8d8f5" />
          <stop offset="100%" stopColor="#6bb8e8" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#c8e8fa" />
          <stop offset="100%" stopColor="#5aaad8" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id}-edge)`} stroke="rgba(90,170,216,0.3)" strokeWidth="16" d="M283.39,624.22c-13.36,4.42-27.68.92-38.02-8.6-9.11-8.38-15.79-18.59-19.6-30.36l-11.25-34.71c-5.84-18.02-11.19-35.37-19.86-52.19-18.55-35.99-49.68-62.09-88.22-74.84l-45.43-12.53c-20.65-5.69-45.02-14.73-55.55-33.29-8-14.1-7.19-30.1,2.36-43.17,15.69-21.46,45.08-28.92,69.82-36.01l33.43-9.58c23.08-6.61,43.51-19.41,60.62-36.34l6.6-7.54c14.35-16.41,23.14-36.5,29.38-57.47l9.51-37.53c5.57-21.99,16.02-46.39,38.05-53.68,13.7-4.53,27.46-1.11,38.03,8.53,25.63,23.39,23.97,67.31,40.45,103.36,7.76,16.97,17.54,32.27,31.25,44.71,26.31,23.86,47.15,29.48,77.44,40.68l34.98,12.94c9.87,3.65,18.18,10.09,24.64,18.27,12.32,15.61,12.46,36.51-.08,52.12-8.57,10.67-20.09,17.86-32.88,22.95l-39.33,15.63c-31.62,12.57-58.51,33.68-76.08,63.01-8.47,14.15-14.81,29.08-18.72,45.21l-8.59,35.37c-6.3,25.94-16.47,56.3-42.95,65.05Z"/>
      <g transform="translate(8,8) scale(0.975)">
        <path fill={`url(#${id}-fill)`} d="M283.39,624.22c-13.36,4.42-27.68.92-38.02-8.6-9.11-8.38-15.79-18.59-19.6-30.36l-11.25-34.71c-5.84-18.02-11.19-35.37-19.86-52.19-18.55-35.99-49.68-62.09-88.22-74.84l-45.43-12.53c-20.65-5.69-45.02-14.73-55.55-33.29-8-14.1-7.19-30.1,2.36-43.17,15.69-21.46,45.08-28.92,69.82-36.01l33.43-9.58c23.08-6.61,43.51-19.41,60.62-36.34l6.6-7.54c14.35-16.41,23.14-36.5,29.38-57.47l9.51-37.53c5.57-21.99,16.02-46.39,38.05-53.68,13.7-4.53,27.46-1.11,38.03,8.53,25.63,23.39,23.97,67.31,40.45,103.36,7.76,16.97,17.54,32.27,31.25,44.71,26.31,23.86,47.15,29.48,77.44,40.68l34.98,12.94c9.87,3.65,18.18,10.09,24.64,18.27,12.32,15.61,12.46,36.51-.08,52.12-8.57,10.67-20.09,17.86-32.88,22.95l-39.33,15.63c-31.62,12.57-58.51,33.68-76.08,63.01-8.47,14.15-14.81,29.08-18.72,45.21l-8.59,35.37c-6.3,25.94-16.47,56.3-42.95,65.05Z"/>
      </g>
      <path fill={`url(#${id}-edge)`} stroke="rgba(90,170,216,0.3)" strokeWidth="10" d="M566.24,189.1c-5.51,17.06-12.16,36.33-32.49,34.81-7.19-.54-13.8-4.68-18.36-11.36-9.25-13.54-10.94-33.95-26.05-51.79-18.62-21.99-39.93-22.15-53.83-33-5.85-4.57-9.56-10.02-9.84-16.78-.29-6.71,2.52-12.91,7.73-17.86,11.76-11.16,34.28-13.3,50.87-29.99,18.41-18.52,19.4-40.08,30.52-53.45,7.88-9.48,21.11-12.94,31.78-6.11,14.26,9.13,16.25,29.81,26.68,46.23,9.89,15.56,25.11,25.51,42.3,31.79,7.15,2.61,13.57,5.63,19.28,10.64,7.73,6.79,10.69,18.67,5.07,27.55-4.96,7.84-12.96,12.22-21.47,15.47-28.52,10.89-42.75,24.6-52.2,53.84Z"/>
      <g transform="translate(4,4) scale(0.988)">
        <path fill={`url(#${id}-fill)`} d="M566.24,189.1c-5.51,17.06-12.16,36.33-32.49,34.81-7.19-.54-13.8-4.68-18.36-11.36-9.25-13.54-10.94-33.95-26.05-51.79-18.62-21.99-39.93-22.15-53.83-33-5.85-4.57-9.56-10.02-9.84-16.78-.29-6.71,2.52-12.91,7.73-17.86,11.76-11.16,34.28-13.3,50.87-29.99,18.41-18.52,19.4-40.08,30.52-53.45,7.88-9.48,21.11-12.94,31.78-6.11,14.26,9.13,16.25,29.81,26.68,46.23,9.89,15.56,25.11,25.51,42.3,31.79,7.15,2.61,13.57,5.63,19.28,10.64,7.73,6.79,10.69,18.67,5.07,27.55-4.96,7.84-12.96,12.22-21.47,15.47-28.52,10.89-42.75,24.6-52.2,53.84Z"/>
      </g>
    </svg>
  );
}

// Glass style tokens
const glass = {
  background: '#ffffff',
  backdropFilter: 'none',
  WebkitBackdropFilter: 'none',
  border: '1px solid rgba(255,255,255,0.3)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
};

// ===== Gemini 스타일 마크다운 — 평문 친화적, heading bold, 단락 여백 =====
function renderInline(text) {
  // **bold** 처리. 안전한 split 기반.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return <strong key={i} style={{ fontWeight: 700 }}>{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

function renderChatMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const blocks = [];
  let para = [];
  let bullets = [];
  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push({ type: 'p', text: para.join(' ') });
    para = [];
  };
  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push({ type: 'ul', items: bullets });
    bullets = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') { flushPara(); flushBullets(); blocks.push({ type: 'gap' }); continue; }
    if (line.startsWith('### ')) { flushPara(); flushBullets(); blocks.push({ type: 'h3', text: line.slice(4) }); continue; }
    if (line.startsWith('## '))  { flushPara(); flushBullets(); blocks.push({ type: 'h2', text: line.slice(3) }); continue; }
    if (line.startsWith('# '))   { flushPara(); flushBullets(); blocks.push({ type: 'h2', text: line.slice(2) }); continue; }
    if (/^[-•]\s+/.test(line))   { flushPara(); bullets.push(line.replace(/^[-•]\s+/, '')); continue; }
    flushBullets();
    para.push(line);
  }
  flushPara(); flushBullets();

  // gap 연속은 한 번만
  const compact = [];
  for (const b of blocks) {
    if (b.type === 'gap' && compact[compact.length - 1]?.type === 'gap') continue;
    compact.push(b);
  }

  return compact.map((b, i) => {
    if (b.type === 'gap') return <div key={i} style={{ height: 10 }} />;
    if (b.type === 'h2') return <div key={i} style={{ fontSize: 17, fontWeight: 700, color: '#1F1F1F', marginTop: i === 0 ? 0 : 14, marginBottom: 6, letterSpacing: -0.2 }}>{renderInline(b.text)}</div>;
    if (b.type === 'h3') return <div key={i} style={{ fontSize: 15, fontWeight: 700, color: '#1F1F1F', marginTop: i === 0 ? 0 : 10, marginBottom: 4, letterSpacing: -0.1 }}>{renderInline(b.text)}</div>;
    if (b.type === 'ul') return (
      <ul key={i} style={{ margin: '4px 0 4px 0', paddingLeft: 18, color: '#1F1F1F' }}>
        {b.items.map((it, j) => (
          <li key={j} style={{ marginBottom: 2, lineHeight: 1.6 }}>{renderInline(it)}</li>
        ))}
      </ul>
    );
    // p
    return <div key={i} style={{ marginBottom: 0, color: '#1F1F1F', lineHeight: 1.65 }}>{renderInline(b.text)}</div>;
  });
}

export default function LuaChatSheet({ open, onClose, initialContext, onNavigateCare }) {
  const [messages, setMessages] = useState([]);
  // messages를 ref로 미러링 — sendMessage·handleRegen 등에서 deps 없이 최신 messages 접근.
  // sendMessage가 messages deps에 의존하면 SSE 매 delta마다 새 함수 → 메모이즈 무효화 → 메시지 누적 시 화면 freeze.
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pendingImages, setPendingImages] = useState([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [personaId, setPersonaId] = useState(() => getActivePersonaId());
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);
  const [appliedRoutineKeys, setAppliedRoutineKeys] = useState(() => new Set());
  const applyingRef = useRef(new Set()); // 동기 잠금 — React state 비동기로 인한 중복 호출 방지
  const [toast, setToast] = useState(null); // { text, action: { label, onClick } | null }
  const [emptyPrompt, setEmptyPrompt] = useState(() => pickEmptyPrompt(getActivePersonaId()));
  // sheet open되거나 페르소나 바뀔 때 새 문구 픽
  useEffect(() => {
    setEmptyPrompt(pickEmptyPrompt(personaId));
  }, [open, personaId]);

  const showToast = useCallback((text, action = null) => {
    setToast({ text, action });
    setTimeout(() => setToast(null), action ? 4200 : 2600);
  }, []);

  const handleApplyRoutine = useCallback((messageKey, routine) => {
    if (!routine) return;
    if (applyingRef.current.has(messageKey)) return;
    applyingRef.current.add(messageKey);

    const existing = getProducts();
    const all = [...(routine.morning || []), ...(routine.night || [])];
    // block-level dedup by brand+name
    const seen = new Set();
    const items = [];
    for (const it of all) {
      const k = `${(it.brand || '').toLowerCase()}|${(it.name || '').toLowerCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      items.push(it);
    }

    let added = 0, skipped = 0;
    for (const it of items) {
      // ingredients sanitize — string·array 둘 다 처리
      let ingObj = null;
      if (it.ingredients) {
        const arr = Array.isArray(it.ingredients)
          ? it.ingredients.map(s => String(s).trim()).filter(Boolean)
          : String(it.ingredients).split(',').map(s => s.trim()).filter(Boolean);
        if (arr.length > 0) ingObj = { known: [], estimated: arr, source: 'consult' };
      }
      const existed = findExistingTrackerProduct(existing, it);
      try {
        // 항상 saveProduct 호출 — TrackerStorage가 자동 dedup 또는 신규 push.
        // dedup이 작동하면 기존 정보 보강만 되고 added 카운트엔 반영 안 함.
        saveTrackerProduct({
          brand: it.brand || '',
          name: it.name,
          category: it.category,
          timeSlot: it.timeSlot || 'both',
          ingredients: ingObj,
        });
        if (existed) skipped++;
        else added++;
      } catch (e) {
        showToast(e.message || '등록 중 문제가 생겼어요');
        return;
      }
    }
    setAppliedRoutineKeys(prev => new Set(prev).add(messageKey));
    // 적용 직후 한 번 정리 — AI가 과거에 "토리든 토리든 …" 식으로 보낸 중복 잔재 흡수
    try { dedupeProductsByName(); } catch {}
    hapticSuccess(); // 등록 완료 — 무게감 있는 성공 시그널

    // 토스트 + "케어에서 확인" 액션
    if (added > 0) {
      const msg = skipped > 0 ? `${added}개 등록 · ${skipped}개는 이미 있음` : `${added}개 제품을 케어에 등록했어요`;
      showToast(msg, onNavigateCare ? { label: '케어에서 확인', onClick: onNavigateCare } : null);
    } else if (skipped > 0) {
      showToast(`이미 케어에 모두 등록되어 있어요`, onNavigateCare ? { label: '케어에서 확인', onClick: onNavigateCare } : null);
    }
  }, [showToast, onNavigateCare]);
  const persona = getPersonaById(personaId);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const sheetRef = useRef(null);
  const cameraInputRef = useRef(null);
  const albumInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const dragStartY = useRef(null);
  const dragDelta = useRef(0);
  const MAX_IMAGES = 3;

  // 첫 마운트 1회: 이전 단일 세션 키 정리 (페르소나 구분 없는 옛 데이터)
  useEffect(() => {
    purgeLegacyConsultSession();
    // 이전에 들어간 brand-prefix 중복 1회 정리 (마이그레이션)
    try { dedupeProductsByName(); } catch {}
  }, []);

  useEffect(() => {
    if (open) {
      setClosing(false);
      // 페르소나별 별도 세션 복원
      if (initialContext?.message) {
        setMessages([{ role: 'assistant', content: initialContext.message, timestamp: Date.now() }]);
      } else {
        const prev = loadConsultSession(personaId);
        setMessages(prev && Array.isArray(prev) && prev.length > 0 ? prev : []);
      }
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) { meta._prev = meta.content; meta.content = '#85b5cc'; }
    } else {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta && meta._prev) { meta.content = meta._prev; delete meta._prev; }
    }
  }, [open, initialContext, personaId]);

  // 메시지 변경 시 자동 저장 — 현재 페르소나 슬롯에 저장
  useEffect(() => {
    if (!open) return;
    if (messages.length === 0) return;
    saveConsultSession(messages, personaId);
  }, [messages, open, personaId]);

  // 사용자 터치 인터랙션 감지 — 사용자가 직접 스크롤할 땐 자동 스크롤 멈춤(자유롭게 위아래 이동).
  // touchend 후 700ms 동안 자동 스크롤 lockout. 그 사이 사용자가 다시 bottom 근처로 내리면 정상 재개.
  const userScrollingRef = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let releaseTimer = null;
    const onTouchStart = () => {
      userScrollingRef.current = true;
      if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null; }
    };
    const onTouchEnd = () => {
      if (releaseTimer) clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => { userScrollingRef.current = false; }, 700);
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      if (releaseTimer) clearTimeout(releaseTimer);
    };
  }, []);

  // 자동 스크롤 — 사용자 터치 중이거나 위로 올라가 있으면 강제 X.
  useEffect(() => {
    if (userScrollingRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (!nearBottom) return; // 사용자가 위쪽 읽는 중 → 자동 스크롤 X
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [messages, isLoading]);

  // iOS Keyboard sticky — Capacitor 이벤트로 정확한 키보드 높이 추적
  // dvh가 작동하지 않는 환경에 대비한 명시적 fallback. native iOS에서만 활성화.
  useEffect(() => {
    if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform?.()) return;
    let showSub = null, hideSub = null;
    let cancelled = false;
    (async () => {
      try {
        showSub = await Keyboard.addListener('keyboardWillShow', info => {
          if (!cancelled) setKeyboardHeight(info?.keyboardHeight || 0);
        });
        hideSub = await Keyboard.addListener('keyboardWillHide', () => {
          if (!cancelled) setKeyboardHeight(0);
        });
      } catch {}
    })();
    return () => {
      cancelled = true;
      try { showSub?.remove?.(); } catch {}
      try { hideSub?.remove?.(); } catch {}
    };
  }, []);

  // STT — OpenAI Whisper(gpt-4o-transcribe) 기반. Web Speech API보다 정확·iOS 안정.
  // MediaRecorder로 녹음 → /api/transcribe → text
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasMic = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasMR = typeof window.MediaRecorder !== 'undefined';
    setSttSupported(hasMic && hasMR);
    return () => {
      try {
        const rec = mediaRecorderRef.current;
        if (rec && rec.state === 'recording') rec.stop();
      } catch {}
      try {
        const stream = audioStreamRef.current;
        if (stream) stream.getTracks().forEach((t) => t.stop());
      } catch {}
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
    };
  }, []);

  const pickSupportedMime = useCallback(() => {
    const candidates = [
      'audio/mp4',                     // iOS/macOS Safari
      'audio/mp4;codecs=mp4a.40.2',
      'audio/webm;codecs=opus',        // Chrome/Edge/Firefox
      'audio/webm',
      'audio/ogg;codecs=opus',
    ];
    if (typeof window === 'undefined' || !window.MediaRecorder) return '';
    for (const c of candidates) {
      try { if (window.MediaRecorder.isTypeSupported(c)) return c; } catch {}
    }
    return '';
  }, []);

  const blobToBase64 = useCallback((blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const idx = String(result).indexOf(',');
      resolve(idx >= 0 ? String(result).slice(idx + 1) : '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  }), []);

  // Close attach menu on outside click
  useEffect(() => {
    if (!showAttachMenu) return;
    const handler = () => setShowAttachMenu(false);
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [showAttachMenu]);

  const toggleListening = useCallback(async () => {
    if (isTranscribing) return;
    // 녹음 중 → stop
    if (isListening) {
      try {
        const rec = mediaRecorderRef.current;
        if (rec && rec.state === 'recording') rec.stop();
      } catch (e) { console.warn('[stt] stop failed', e); }
      if (recordingTimeoutRef.current) { clearTimeout(recordingTimeoutRef.current); recordingTimeoutRef.current = null; }
      return;
    }
    // 녹음 시작
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      audioStreamRef.current = stream;
      const mimeType = pickSupportedMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        try { stream.getTracks().forEach((t) => t.stop()); } catch {}
        audioStreamRef.current = null;
        setIsListening(false);
        if (recordingTimeoutRef.current) { clearTimeout(recordingTimeoutRef.current); recordingTimeoutRef.current = null; }
        if (chunks.length === 0) return;
        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: finalMime });
        if (blob.size < 1000) return; // 너무 짧음 → 무시
        setIsTranscribing(true);
        try {
          const base64 = await blobToBase64(blob);
          const resp = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64, mime: finalMime }),
          });
          if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${resp.status}`);
          }
          const data = await resp.json();
          const text = (data.text || '').trim();
          if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
        } catch (e) {
          console.warn('[stt] transcribe failed:', e?.message || e);
        } finally {
          setIsTranscribing(false);
        }
      };
      recorder.onerror = (e) => {
        console.warn('[stt] recorder error', e);
        setIsListening(false);
      };
      recorder.start();
      setIsListening(true);
      // 안전망 — 60초 초과 자동 stop
      recordingTimeoutRef.current = setTimeout(() => {
        try { if (recorder.state === 'recording') recorder.stop(); } catch {}
      }, 60000);
    } catch (e) {
      console.warn('[stt] mic access failed:', e?.message || e);
      setIsListening(false);
      audioStreamRef.current = null;
    }
  }, [isListening, isTranscribing, pickSupportedMime, blobToBase64]);

  const processFile = useCallback((file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target.result;
        const compressed = await compressImage(dataUrl, 1024, 0.85);
        const base64 = compressed.split(',')[1];
        resolve({ dataUrl, base64 });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    e.target.value = '';
    setShowAttachMenu(false);
    const results = await Promise.all(files.slice(0, MAX_IMAGES).map(processFile));
    const valid = results.filter(Boolean);
    if (valid.length > 0) { setPendingImages(prev => [...prev, ...valid].slice(0, MAX_IMAGES)); }
  }, [processFile]);

  const handleClose = useCallback(() => {
    setClosing(true);
    // 닫을 때 메시지는 유지 — 다시 열면 같은 대화 이어감
    setTimeout(() => { onClose(); setInput(''); setClosing(false); }, 240);
  }, [onClose]);

  const buildContext = useCallback(() => {
    const records = getRecords();
    const recentHistory = records.slice(-5).map(r => ({
      date: r.date, overallScore: r.overallScore, skinAge: r.skinAge,
      moisture: r.moisture, wrinkleScore: r.wrinkleScore, elasticityScore: r.elasticityScore,
      timestamp: r.timestamp || null,
    }));
    const changes = getSmoothedChanges() || getChanges();
    const profile = getProfile();
    const latest = getLatestRecord();

    // 측정 시간대 분류 — 상담사가 시점 인식해서 답변 (아침 측정 → 자고 일어난 상태 진단 등)
    const classifyTimeSlot = (ts) => {
      if (!ts) return null;
      const d = new Date(ts);
      const h = d.getHours();
      const ko = h >= 5 && h < 11 ? '아침'
        : h >= 11 && h < 14 ? '점심'
        : h >= 14 && h < 18 ? '오후'
        : h >= 18 && h < 22 ? '저녁'
        : '자기 전(밤)';
      return { key: ko, hour: h, dateTime: d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) };
    };

    // 방금 측정 (60분 이내) — 시스템 프롬프트에서 우선 짚을 수 있게
    const measuredAt = latest?.timestamp || null;
    const minutesSinceMeasurement = measuredAt ? Math.round((Date.now() - measuredAt) / 60000) : null;
    const measuredJustNow = minutesSinceMeasurement != null && minutesSinceMeasurement <= 60;

    return {
      currentResult: latest || null,
      history: recentHistory,
      changes,
      stableSkinAge: getStableSkinAge(),
      profile: { nickname: profile.nickname, birthYear: profile.birthYear, gender: profile.gender, skinType: profile.skinType },
      products: getProductsWithUsageContext(),
      routineSnapshot: getRoutineSnapshot(),
      recentTrend: getRecentTrend(7),
      longTrend: getRecentTrend(30),
      userMemory: getMemoryContext(),
      routineRecommendation: serializeRoutineForPrompt(buildRoutineRecommendation(latest, getProducts())),
      productInteractions: serializeInteractionsForPrompt(detectInteractions(getProducts())),
      // 측정 시점 컨텍스트 — 상담사가 인식해서 활용
      measurementTimeSlot: classifyTimeSlot(measuredAt),
      minutesSinceMeasurement,
      measuredJustNow,
    };
  }, []);

  const sendMessage = useCallback(async (text) => {
    const msgText = (text || '').trim();
    const imgs = pendingImages.length > 0 ? pendingImages : null;
    if (!msgText && !imgs) return;
    if (isLoading) return;

    const defaultMsg = imgs && imgs.length > 1 ? '이 화장품들을 비교 분석해주세요.' : imgs ? '이 화장품 내 피부에 맞는지 분석해주세요.' : '';
    const userMsg = {
      role: 'user', content: msgText || defaultMsg, timestamp: Date.now(),
      imageThumbs: imgs ? imgs.map(img => img.dataUrl) : null,
    };
    setMessages(prev => [...prev, userMsg]);
    recordUserMessage(userMsg.content);
    setInput('');
    setPendingImages([]);
    setIsLoading(true);

    const conversationHistory = messagesRef.current
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));
    try {
      const body = { message: userMsg.content, context: buildContext(), conversationHistory, stream: true, persona: personaId };
      if (imgs && imgs.length === 1) body.image = imgs[0].base64;
      else if (imgs && imgs.length > 1) body.images = imgs.map(img => img.base64);

      const response = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `HTTP ${response.status}`); }

      // SSE 스트리밍 — 서버 chunk가 불규칙해서 그대로 setMessages하면 툭툭 끊김.
      // 누적된 fullText를 rAF로 부드럽게 흘려보내는 typewriter 효과로 변환.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';    // 서버에서 누적된 전체
      let displayedLen = 0;       // 현재 화면에 노출된 글자 수
      let bubbleAdded = false;
      let streamError = null;
      let isStreamDone = false;
      let rafId = null;

      const flushDisplay = () => {
        if (!bubbleAdded) return;
        const target = assistantText.length;
        if (displayedLen < target) {
          const remaining = target - displayedLen;
          // 남은 글자의 ~12%씩 (최소 1, 최대 8). 길수록 빨리, 끝엔 천천히 — 자연스러운 호흡.
          const step = Math.max(1, Math.min(8, Math.ceil(remaining * 0.12)));
          displayedLen = Math.min(displayedLen + step, target);
          const shown = assistantText.slice(0, displayedLen);
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last) next[next.length - 1] = { ...last, content: shown };
            return next;
          });
        }
        // 스트림 진행 중이거나 아직 보여줄 글자 남았으면 계속
        if (!isStreamDone || displayedLen < assistantText.length) {
          rafId = requestAnimationFrame(flushDisplay);
        } else {
          rafId = null;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data: ')) continue;
          const payload = t.slice(6);
          if (payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.error) {
              streamError = evt.detail ? `${evt.error} — ${evt.detail}` : evt.error;
              continue;
            }
            if (evt.delta) {
              assistantText += evt.delta;
              if (!bubbleAdded) {
                bubbleAdded = true;
                setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: Date.now() }]);
                rafId = requestAnimationFrame(flushDisplay);
              }
              // rAF가 자체 loop으로 계속 갱신하므로 여기서 setMessages 호출 X
            }
          } catch {}
        }
      }

      // 스트림 종료 신호 — rAF가 남은 글자 끝까지 흘려보냄
      isStreamDone = true;
      // 안전: rAF가 미동작이면 즉시 final flush
      if (!rafId && bubbleAdded) {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last) next[next.length - 1] = { ...last, content: assistantText };
          return next;
        });
      }
      // 마지막 글자까지 노출되도록 잠시 대기 (rAF가 끝낼 시간)
      const waitForDisplay = () => new Promise(resolve => {
        const check = () => {
          if (displayedLen >= assistantText.length || !bubbleAdded) resolve();
          else requestAnimationFrame(check);
        };
        check();
      });
      if (bubbleAdded) await waitForDisplay();

      if (streamError) throw new Error(streamError);
      if (!bubbleAdded) {
        setMessages(prev => [...prev, { role: 'assistant', content: '잠시 문제가 생겼어요. 다시 시도해주세요.', timestamp: Date.now() }]);
      }
    } catch (err) {
      const m = err?.message || '';
      let content;
      if (m.includes('429')) {
        content = '오늘 상담 횟수를 초과했어요. 내일 다시 이용해주세요!';
      } else {
        // 사용자가 무슨 일이 있었는지 알 수 있게 detail을 작게 첨부 (진단 용이성 ↑)
        const detail = m ? ` (${m.slice(0, 180)})` : '';
        content = `잠시 문제가 생겼어요. 다시 시도해주세요.${detail}`;
      }
      setMessages(prev => [...prev, { role: 'assistant', timestamp: Date.now(), content }]);
    } finally { setIsLoading(false); }
  }, [isLoading, buildContext, pendingImages, personaId]);

  // 페르소나 변경 — 새 채팅 시작 + localStorage 저장 + 환영 메시지
  const handleSelectPersona = useCallback((id) => {
    if (!id || id === personaId) {
      setPersonaPickerOpen(false);
      return;
    }
    // 페르소나만 전환 — 진행 중 대화는 그대로 유지 (사용자가 자연스럽게 톤만 바꿔서 이어감)
    setActivePersonaId(id);
    setPersonaId(id);
    setPersonaPickerOpen(false);
  }, [personaId]);

  const canSend = (input.trim() || pendingImages.length > 0) && !isLoading;
  const handleSubmit = useCallback(() => { sendMessage(input); }, [input, sendMessage]);

  // 메시지 컴포넌트가 props로 받는 안정된 callback들 — React.memo로 재렌더 최소화.
  const handleSendQuickReply = useCallback((opt) => {
    hapticLight();
    setInput('');
    sendMessage(opt);
  }, [sendMessage]);

  const handleRegen = useCallback(() => {
    const lastUser = [...messagesRef.current].reverse().find(m => m.role === 'user');
    if (lastUser) {
      setMessages(prev => prev.slice(0, -1));
      sendMessage(lastUser.content);
    }
  }, [sendMessage]);

  const handleCopy = useCallback((text) => {
    try { navigator.clipboard?.writeText(text); } catch {}
  }, []);

  const onTouchStart = (e) => { dragStartY.current = e.touches[0].clientY; };
  const onTouchMove = (e) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) { dragDelta.current = delta; if (sheetRef.current) sheetRef.current.style.transform = `translateY(${delta}px)`; }
  };
  const onTouchEnd = () => {
    if (dragDelta.current > 120) { handleClose(); }
    else if (sheetRef.current) { sheetRef.current.style.transform = 'translateY(0)'; sheetRef.current.style.transition = 'transform 0.2s ease'; setTimeout(() => { if (sheetRef.current) sheetRef.current.style.transition = ''; }, 200); }
    dragStartY.current = null; dragDelta.current = 0;
  };

  const shouldShowTime = (msgs, idx) => {
    if (idx === msgs.length - 1) return true;
    if (msgs[idx].role !== msgs[idx + 1].role) return true;
    if (msgs[idx + 1].timestamp - msgs[idx].timestamp > 300000) return true;
    return false;
  };
  const isConsecutive = (msgs, idx) => idx > 0 && msgs[idx].role === msgs[idx - 1].role;

  if (!open) return null;

  // lua avatar (glass circle + star icon, same as FAB)
  const luaAvatar = (size) => (
    <div style={{
      width: size, height: size, minWidth: size, minHeight: size,
      borderRadius: '50%', flexShrink: 0,
      background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.8), rgba(172,226,252,0.35))',
      border: 'none',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      aspectRatio: '1 / 1', boxSizing: 'border-box',
    }}>
      <StarIcon size={size * 0.55} />
    </div>
  );

  return (
    <>
      {/* Hidden file inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} style={{ display: 'none' }} />
      <input ref={albumInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />

      {/* Scrim */}
      <div onClick={handleClose} style={{
        position: 'fixed', top: 'calc(-1 * env(safe-area-inset-top, 50px))', left: 0, right: 0, bottom: 0, zIndex: 200,
        background: 'rgba(4,44,83,0.12)',
        backdropFilter: 'none', WebkitBackdropFilter: 'none',
        opacity: closing ? 0 : 1, transition: 'opacity 200ms',
      }} />

      {/* Sheet — Gemini Flash 스타일 (거의 풀스크린 + 그라데이션)
          height: Capacitor 키보드 이벤트 우선, fallback으로 dvh.
          composer는 flex column 마지막이라 sheet가 줄어들면 자동으로 키보드 위에 sticky. */}
      <div ref={sheetRef} style={{
        position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex: 201,
        height: keyboardHeight > 0
          ? `calc(100% - ${keyboardHeight}px)`
          : '100dvh',
        transition: 'height 0.22s cubic-bezier(0.32,0.72,0,1)',
        background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 45%, #EAF4FB 100%)',
        borderRadius: 0,
        boxShadow: 'none',
        display: 'flex', flexDirection: 'column',
        animation: closing ? 'luaChatSlideDown 240ms ease forwards' : 'luaChatSlideUp 280ms cubic-bezier(0.32,0.72,0,1) forwards',
        maxWidth: 430, margin: '0 auto',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}>
        <style>{`
          @keyframes luaChatSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes luaChatSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
          @keyframes luaDot { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
          .gem-btn { transition: transform 0.12s ease, opacity 0.12s ease; -webkit-tap-highlight-color: transparent; }
          .gem-btn:active { transform: scale(0.92); opacity: 0.75; }
          .gem-input-btn { transition: transform 0.12s ease, opacity 0.12s ease, background 0.12s ease; -webkit-tap-highlight-color: transparent; }
          .gem-input-btn:active { transform: scale(0.9); opacity: 0.7; }
          .gem-act { background: transparent; border: none; cursor: pointer; padding: 6px; border-radius: 10px; transition: background 0.15s, transform 0.12s; -webkit-tap-highlight-color: transparent; display: inline-flex; align-items: center; justify-content: center; }
          .gem-act:active { transform: scale(0.92); background: rgba(0,0,0,0.06); }
        `}</style>

        {/* Persona Picker — chevron 클릭 시 헤더 아래 슬라이드 다운 */}
        <PersonaPicker
          open={personaPickerOpen}
          activeId={personaId}
          onSelect={handleSelectPersona}
          onClose={() => setPersonaPickerOpen(false)}
          anchorTop={72}
        />

        {/* Handle (드래그 닫기) */}
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', cursor: 'grab' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ececec' }} />
        </div>

        {/* Gemini Flash Style Header — X(좌) · lua●(중앙) · 새 채팅(우) */}
        <div style={{
          padding: '8px 16px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button onClick={handleClose} aria-label="채팅 닫기" className="gem-btn" style={{
            width: 36, height: 36, borderRadius: 18,
            background: '#ffffff',
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <button
            onClick={() => setPersonaPickerOpen(v => !v)}
            aria-label="모델 선택"
            className="gem-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 8px', borderRadius: 12,
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span style={{
              fontSize: 22, fontWeight: 500, color: '#1F1F1F',
              letterSpacing: -0.3, lineHeight: 1,
              fontFamily: 'var(--font-display), Pretendard, -apple-system, sans-serif',
            }}>lua</span>
            <span style={{
              fontSize: 15, fontWeight: 400, color: '#5F6368',
              letterSpacing: -0.2, lineHeight: 1, marginLeft: 2,
            }}>{persona.short}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2, transition: 'transform 0.18s', transform: personaPickerOpen ? 'rotate(180deg)' : 'none' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          <button onClick={() => { clearConsultSession(personaId); setMessages([]); setInput(''); setPendingImages([]); applyingRef.current = new Set(); }} aria-label="새 채팅" className="gem-btn" style={{
            width: 36, height: 36, borderRadius: 18,
            background: '#ffffff',
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </button>
        </div>

        {/* Messages or Empty State (Gemini Flash 스타일) */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: 'auto', padding: '18px 18px 8px',
          display: 'flex', flexDirection: 'column', gap: 6,
          WebkitOverflowScrolling: 'touch',
        }}>
          {messages.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '32px 24px 80px',
              gap: 20,
            }}>
              {/* luastar */}
              <img src="/luastar.svg" alt="" style={{ width: 56, height: 56 }} />
              <div style={{
                fontSize: 28, fontWeight: 500, color: '#1F1F1F',
                letterSpacing: -0.5, lineHeight: 1.3,
                fontFamily: 'var(--font-display), Pretendard, -apple-system, sans-serif',
                maxWidth: 320,
              }}>
                {emptyPrompt}
              </div>
            </div>
          ) : (
          <>
          {/* "오늘" 표시 제거 — Gemini와 동일하게 깔끔 */}

          {messages.map((msg, i) => {
            const isLua = msg.role === 'assistant';
            const isLast = i === messages.length - 1;

            if (isLua) {
              const messageKey = msg.timestamp ? `t-${msg.timestamp}` : `i-${i}`;
              return (
                <LuaAssistantMessage
                  key={i}
                  content={msg.content}
                  isLast={isLast}
                  isLoading={isLoading}
                  messageKey={messageKey}
                  isApplied={appliedRoutineKeys.has(messageKey)}
                  onApplyRoutine={handleApplyRoutine}
                  onSendQuickReply={handleSendQuickReply}
                  onRegen={handleRegen}
                  onCopy={handleCopy}
                />
              );
            }
            // User message — 옅은 회색 캡슐, 오른쪽 정렬
            return (
              <div key={i} style={{ padding: '6px 0' }}>
                {msg.imageThumbs && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 6 }}>
                    {msg.imageThumbs.map((src, ti) => (
                      <img key={ti} src={src} alt="" style={{ width: 88, height: 88, borderRadius: 14, objectFit: 'cover' }} />
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    background: '#F1F3F4',
                    padding: '11px 18px',
                    borderRadius: 20,
                    maxWidth: '82%',
                    fontSize: 16, color: '#1F1F1F', lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    letterSpacing: -0.1,
                  }}>{msg.content}</div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator — 평문 위치에 점 3개만 (버블 없음) */}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 2px', height: 24 }}>
              {[0, 1, 2].map(j => (
                <div key={j} style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#6598ef',
                  animation: `luaDot 1.2s ease-in-out ${j * 0.24}s infinite`,
                }} />
              ))}
            </div>
          )}
          </>
          )}
        </div>

        {/* Image Preview */}
        {pendingImages.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
            flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.3)',
          }}>
            {pendingImages.map((img, idx) => (
              <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
                <img src={img.dataUrl} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.3)' }} />
                <button onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))} style={{
                  position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: '50%',
                  border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
            {pendingImages.length < MAX_IMAGES && (
              <button onClick={() => albumInputRef.current?.click()} style={{
                width: 72, height: 72, borderRadius: 12,
                border: '2px dashed rgba(101,152,239,0.4)', background: 'rgba(101,152,239,0.08)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', gap: 2, flexShrink: 0,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span style={{ fontSize: 10, color: '#6598ef', fontWeight: 600 }}>추가</span>
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted, #8B95A1)', width: '100%' }}>
              {`사진 ${pendingImages.length}/${MAX_IMAGES}장`}
              {pendingImages.length >= 2 && ' · 비교 분석 가능'}
            </span>
          </div>
        )}

        {/* Composer */}
        <div style={{
          padding: '8px 14px calc(16px + env(safe-area-inset-bottom, 0px))',
          borderTop: 'none',
          background: 'transparent',
          position: 'relative',
        }}>
          {/* Attach Menu */}
          {showAttachMenu && (
            <div onClick={(e) => e.stopPropagation()} style={{
              position: 'absolute', bottom: '100%', left: 14, marginBottom: 8,
              ...glass, background: '#ffffff',
              borderRadius: 22, overflow: 'hidden', zIndex: 10,
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            }}>
              <button onClick={() => { cameraInputRef.current?.click(); setShowAttachMenu(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
                border: 'none', background: 'none', width: '100%', fontSize: 14, fontWeight: 500,
                color: 'var(--text-primary, #191F28)', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>
                </svg>
                카메라로 촬영
              </button>
              <button onClick={() => { albumInputRef.current?.click(); setShowAttachMenu(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
                border: 'none', background: 'none', width: '100%', fontSize: 14, fontWeight: 500,
                color: 'var(--text-primary, #191F28)', cursor: 'pointer', fontFamily: 'inherit',
                borderTop: '1px solid rgba(255,255,255,0.3)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                앨범에서 선택
              </button>
            </div>
          )}

          <div style={{
            display: 'flex', gap: 8, alignItems: 'center', width: '100%',
            background: '#ffffff', borderRadius: 44,
            border: '1px solid rgba(0,0,0,0.06)',
            padding: '10px 12px', boxSizing: 'border-box',
            boxShadow: '0 2px 14px rgba(0,0,0,0.06)',
            minHeight: 64,
          }}>
            {/* + Attach Button — Gemini와 동일하게 평면 큰 + 아이콘 */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowAttachMenu(!showAttachMenu); }}
              disabled={isLoading}
              className="gem-input-btn"
              style={{
                width: 52, height: 52, borderRadius: '50%', border: 'none',
                background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>

            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSubmit(); } }}
              placeholder={isListening ? '듣고 있어요... 마이크 다시 눌러주세요' : isTranscribing ? '음성을 텍스트로 변환 중...' : pendingImages.length > 0 ? '메시지와 함께 전송...' : 'lua에게 물어보세요'}
              disabled={isLoading || isTranscribing}
              style={{
                flex: 1, minWidth: 0, padding: '18px 6px', borderRadius: 0,
                border: 'none', background: 'transparent',
                fontSize: 18, color: '#1F1F1F',
                fontFamily: 'inherit', outline: 'none',
                letterSpacing: -0.1,
                lineHeight: 1.4,
              }}
            />

            {/* Mic Button — Whisper STT. 인식 중 pulse ring, 변환 중 spinner */}
            {sttSupported && (
              <button
                onClick={toggleListening}
                disabled={isLoading || isTranscribing}
                className="gem-input-btn"
                aria-label={isListening ? '녹음 정지' : isTranscribing ? '변환 중' : '음성 입력'}
                style={{
                  position: 'relative',
                  width: 52, height: 52, borderRadius: '50%', border: 'none',
                  background: isListening ? 'rgba(101,152,239,0.18)' : isTranscribing ? 'rgba(101,152,239,0.10)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                  opacity: (isLoading || isTranscribing) ? 0.7 : 1, transition: 'background 0.18s',
                }}
              >
                {isTranscribing && (
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: '2.4px solid rgba(101,152,239,0.25)',
                    borderTopColor: '#6598ef',
                    animation: 'sttSpin 0.85s linear infinite',
                  }} />
                )}
                <style>{`@keyframes sttSpin { to { transform: rotate(360deg); } }`}</style>
                {isListening && (
                  <>
                    <span style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      border: '2px solid #6598ef',
                      animation: 'sttPulseA 1.4s ease-out infinite',
                      pointerEvents: 'none',
                    }} />
                    <span style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      border: '2px solid #6598ef',
                      animation: 'sttPulseA 1.4s ease-out 0.7s infinite',
                      pointerEvents: 'none',
                    }} />
                    <style>{`@keyframes sttPulseA { 0% { transform: scale(1); opacity: 0.55; } 100% { transform: scale(1.6); opacity: 0; } }`}</style>
                  </>
                )}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={isListening ? '#6598ef' : '#5F6368'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="11" rx="3"/><path d="M19 10v1a7 7 0 01-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/>
                </svg>
              </button>
            )}

            {/* Send / Sound-wave Button — 텍스트 있으면 send, 없으면 음성 wave chip (Gemini 패턴) */}
            <button
              onClick={canSend ? handleSubmit : toggleListening}
              disabled={isLoading}
              className="gem-input-btn"
              style={{
                width: 52, height: 52, borderRadius: '50%', border: 'none',
                background: canSend ? '#1F1F1F' : 'rgba(101,152,239,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: canSend ? 'pointer' : 'pointer',
                flexShrink: 0, transition: 'background 0.2s',
              }}
            >
              {canSend ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              ) : (
                // Sound-wave 아이콘 (Gemini와 동일)
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5F8FB5" strokeWidth="2" strokeLinecap="round">
                  <line x1="6" y1="9" x2="6" y2="15"/>
                  <line x1="10" y1="6" x2="10" y2="18"/>
                  <line x1="14" y1="8" x2="14" y2="16"/>
                  <line x1="18" y1="10" x2="18" y2="14"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Toast — 케어 등록 결과 */}
      {toast && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 'calc(120px + env(safe-area-inset-bottom,0px))',
          transform: 'translateX(-50%)',
          background: '#1F2937', color: '#fff',
          padding: toast.action ? '10px 10px 10px 18px' : '12px 18px',
          borderRadius: 22,
          fontSize: 13.5, fontWeight: 600, letterSpacing: -0.2,
          boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
          zIndex: 10500,
          animation: 'toastRise 220ms ease-out',
          maxWidth: '86vw',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <style>{`@keyframes toastRise { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
          <span style={{ pointerEvents: 'none' }}>{toast.text}</span>
          {toast.action && (
            <button
              onClick={() => { try { toast.action.onClick(); } catch {}; setToast(null); }}
              style={{
                background: 'rgba(255,255,255,0.16)',
                border: 'none', borderRadius: 16,
                padding: '7px 13px', color: '#A8C9F5',
                fontSize: 12.5, fontWeight: 700, letterSpacing: -0.2,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >{toast.action.label}</button>
          )}
        </div>
      )}
    </>
  );
}

// ===== 상담 응답에 첨부되는 "이 루틴 케어에 적용" 카드 =====
function ApplyRoutineCard({ routine, applied, onApply }) {
  const allItems = [
    ...routine.morning.map(it => ({ ...it, _slot: 'morning' })),
    ...routine.night.map(it => ({ ...it, _slot: 'night' })),
  ];
  // dedupe by brand+name
  const seen = new Set();
  const display = [];
  for (const it of allItems) {
    const k = `${(it.brand || '').toLowerCase()}|${it.name.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    display.push(it);
  }
  const total = display.length;

  return (
    <div style={{
      marginTop: 14,
      background: applied ? 'rgba(101,152,239,0.08)' : 'linear-gradient(180deg, #F4F8FF 0%, #EAF1FE 100%)',
      border: '1px solid rgba(101,152,239,0.32)',
      borderRadius: 18,
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1F2937', letterSpacing: -0.2 }}>이 루틴 케어에 적용</div>
      </div>
      <div style={{ marginBottom: 12 }}>
        {['morning', 'night'].map((slot) => {
          const items = display.filter(d => slot === 'morning' ? (d._slot === 'morning' || d.timeSlot === 'both') : (d._slot === 'night' || d.timeSlot === 'both'));
          // 위에서 dedupe 했으므로 양쪽에 같은 _slot 기준으로만
          const slotItems = display.filter(d => d._slot === slot);
          if (slotItems.length === 0) return null;
          return (
            <div key={slot} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6598ef', letterSpacing: 0.5, marginBottom: 4 }}>
                {slot === 'morning' ? '아침' : '저녁'} · {slotItems.length}개
              </div>
              {slotItems.map((it, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'baseline', gap: 6,
                  fontSize: 12.5, color: '#374151', lineHeight: 1.55,
                  padding: '2px 0',
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#6598ef',
                    background: 'rgba(101,152,239,0.14)',
                    padding: '1px 6px', borderRadius: 6,
                    flexShrink: 0, marginRight: 2,
                  }}>{it.category}</span>
                  <span style={{ color: '#1F2937' }}>
                    {it.brand && <strong style={{ fontWeight: 600 }}>{it.brand}</strong>} {it.name}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <button
        onClick={onApply}
        disabled={applied}
        style={{
          width: '100%', padding: '12px 14px',
          background: applied ? 'rgba(101,152,239,0.18)' : 'linear-gradient(135deg, #6598ef, #8ac4fe)',
          border: 'none', borderRadius: 12,
          color: applied ? '#3D7CA8' : '#fff',
          fontSize: 14, fontWeight: 700, letterSpacing: -0.2,
          cursor: applied ? 'default' : 'pointer',
          boxShadow: applied ? 'none' : '0 4px 14px rgba(101,152,239,0.28)',
          fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {applied ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D7CA8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
            <span>케어에 적용됨</span>
          </>
        ) : (
          <>
            <span>케어에 {total}개 등록</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </>
        )}
      </button>
    </div>
  );
}
