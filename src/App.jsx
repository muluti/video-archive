import React, { useState, useEffect, useRef } from "react";
import { auth, db, storage } from "./firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import "./styles.css";

const COLORS = { coral: "#FF6B52", bg: "#F8F9FA", text: "#2C3E50", gray: "#95A5A6", lightGray: "#ECF0F1" };
const PREDEFINED_TAGS = ["일상", "여행", "공부", "운동", "작업", "영감", "숏폼", "기록"];

export default function App() {
  const [init, setInit] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isNewAccount, setIsNewAccount] = useState(false);

  const [viewMode, setViewMode] = useState("gallery");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [videos, setVideos] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [currentCategory, setCurrentCategory] = useState({ type: "all", tag: null });
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [editTags, setEditTags] = useState([]); 
  const [editMemo, setEditMemo] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // 1. 인증 상태 감시
  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setInit(true);
    });
  }, []);

  // 2. 동영상 데이터 실시간 로드
  useEffect(() => {
    if (!isLoggedIn) return;
    const q = query(collection(db, "videos"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVideos(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [isLoggedIn]);

  const onAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isNewAccount) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (error) { alert(error.message); }
  };

  // 3. 동영상 업로드 로직
  const onUpload = async () => {
    if (files.length === 0) return alert("동영상을 선택해주세요!");
    setUploading(true);
    try {
      for (const file of files) {
        const filePath = `videos/${Date.now()}_${file.name}`;
        const fileRef = ref(storage, filePath);
        const result = await uploadBytes(fileRef, file);
        const url = await getDownloadURL(result.ref);
        
        await addDoc(collection(db, "videos"), {
          url,
          fileName: file.name,
          filePath,
          createdAt: serverTimestamp(),
          tags: [],
          memo: ""
        });
      }
      setFiles([]); setViewMode("gallery");
      alert("동영상 업로드 완료!");
    } catch (error) { alert("업로드 실패: " + error.message); }
    finally { setUploading(false); }
  };

  const filteredVideos = videos.filter((vid) => {
    let tagMatch = currentCategory.tag ? vid.tags?.includes(currentCategory.tag) : true;
    let searchMatch = searchKeyword ? (vid.memo?.toLowerCase().includes(searchKeyword.toLowerCase()) || vid.tags?.some(t => t.includes(searchKeyword))) : true;
    return tagMatch && searchMatch;
  });

  if (!init) return <div style={{ padding: "20px", textAlign: "center", color: COLORS.coral }}>Loading...</div>;

  return (
    <div style={{ backgroundColor: "#e9ecef", minHeight: "100vh", display: "flex", justifyContent: "center", fontFamily: 'sans-serif' }}>
      <div style={{ width: "100%", maxWidth: "480px", backgroundColor: COLORS.bg, position: "relative", minHeight: "100vh", boxShadow: "0 0 20px rgba(0,0,0,0.1)" }}>
        
        {isLoggedIn ? (
          <>
            <div style={{ padding: "30px 20px" }}>
              {viewMode === "gallery" ? (
                <div>
                  <h1 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "5px" }}>Video Archive</h1>
                  <p style={{ color: COLORS.gray, fontSize: "14px", marginBottom: "20px" }}>{filteredVideos.length}개의 영상 기록</p>
                  
                  <input 
                    type="text" placeholder="🔍 검색어 입력" 
                    value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)}
                    style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "none", backgroundColor: COLORS.lightGray, marginBottom: "20px", boxSizing: "border-box" }}
                  />

                  {/* 비디오 그리드 */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {filteredVideos.map((vid) => (
                      <div key={vid.id} onClick={() => { setSelectedVideo(vid); setEditTags(vid.tags || []); setEditMemo(vid.memo || ""); setIsSheetOpen(true); }} 
                           style={{ borderRadius: "12px", overflow: "hidden", backgroundColor: "#000", height: "200px", position: "relative", cursor: "pointer" }}>
                        <video src={vid.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "white", opacity: 0.8 }}>
                          <svg width="30" height="30" fill="currentColor" viewBox="0 0 16 16"><path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <h2 style={{ marginBottom: "20px" }}>Upload Video</h2>
                  <input type="file" accept="video/*" multiple onChange={(e) => setFiles(Array.from(e.target.files))} style={{ marginBottom: "20px" }} />
                  <button onClick={onUpload} disabled={uploading} style={{ width: "100%", padding: "15px", backgroundColor: COLORS.coral, color: "#fff", border: "none", borderRadius: "12px", fontWeight: "bold" }}>
                    {uploading ? "업로드 중..." : "동영상 저장하기"}
                  </button>
                  <button onClick={() => setViewMode("gallery")} style={{ width: "100%", marginTop: "10px", background: "none", border: "none", color: COLORS.gray }}>취소</button>
                </div>
              )}
            </div>

            {/* 하단 플로팅 버튼 */}
            <button onClick={() => setViewMode("upload")} style={{ position: "fixed", bottom: "30px", right: "max(30px, calc(50% - 210px))", width: "60px", height: "60px", backgroundColor: COLORS.coral, borderRadius: "50%", border: "none", color: "white", fontSize: "30px", boxShadow: "0 4px 15px rgba(255,107,82,0.4)", zIndex: 100 }}>+</button>

            {/* 비디오 상세 보기 (바텀 시트) */}
            {isSheetOpen && selectedVideo && (
              <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: "480px", backgroundColor: "#fff", borderTopLeftRadius: "25px", borderTopRightRadius: "25px", padding: "20px", boxSizing: "border-box", maxHeight: "90vh", overflowY: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                    <span style={{ fontWeight: "bold" }}>영상 정보</span>
                    <button onClick={() => setIsSheetOpen(false)} style={{ border: "none", background: "none", fontSize: "18px" }}>✕</button>
                  </div>
                  
                  <video src={selectedVideo.url} controls autoPlay style={{ width: "100%", borderRadius: "15px", marginBottom: "20px" }} />
                  
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ fontSize: "12px", color: COLORS.gray }}>메모</label>
                    <textarea value={editMemo} onChange={(e) => setEditMemo(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid #ddd", height: "80px", boxSizing: "border-box" }} />
                  </div>

                  <button onClick={async () => {
                    await updateDoc(doc(db, "videos", selectedVideo.id), { memo: editMemo });
                    alert("저장되었습니다!");
                    setIsSheetOpen(false);
                  }} style={{ width: "100%", padding: "15px", backgroundColor: COLORS.text, color: "#fff", border: "none", borderRadius: "12px", fontWeight: "bold" }}>변경사항 저장</button>
                  
                  <button onClick={async () => {
                    if(window.confirm("삭제하시겠습니까?")) {
                      await deleteDoc(doc(db, "videos", selectedVideo.id));
                      await deleteObject(ref(storage, selectedVideo.filePath));
                      setIsSheetOpen(false);
                    }
                  }} style={{ width: "100%", marginTop: "10px", color: "red", background: "none", border: "none" }}>데이터 영구 삭제</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: "40px", display: "flex", flexDirection: "column", justifyContent: "center", height: "100vh" }}>
            <h1 style={{ fontWeight: "900", fontSize: "32px" }}>Video<br/>Archive.</h1>
            <form onSubmit={onAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "30px" }}>
              <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: "15px", borderRadius: "10px", border: "none", backgroundColor: COLORS.lightGray }} />
              <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: "15px", borderRadius: "10px", border: "none", backgroundColor: COLORS.lightGray }} />
              <button type="submit" style={{ padding: "15px", backgroundColor: COLORS.coral, color: "#fff", border: "none", borderRadius: "10px", fontWeight: "bold" }}>{isNewAccount ? "회원가입" : "로그인"}</button>
            </form>
            <button onClick={() => setIsNewAccount(!isNewAccount)} style={{ marginTop: "20px", background: "none", border: "none", color: COLORS.gray }}>{isNewAccount ? "계정이 있으신가요? 로그인" : "계정이 없으신가요? 가입하기"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
