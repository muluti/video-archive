import React, { useState, useEffect } from "react";
import { auth, db, storage } from "./firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import "./styles.css";

const COLORS = { coral: "#FF6B52", bg: "#F8F9FA", text: "#2C3E50", gray: "#95A5A6", lightGray: "#ECF0F1" };
const PREDEFINED_TAGS = ["일상", "여행", "공부", "운동", "작업", "영감", "숏폼", "기록"];

// 유튜브 ID 추출 함수
const getYoutubeId = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export default function App() {
  const [init, setInit] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isNewAccount, setIsNewAccount] = useState(false);

  const [viewMode, setViewMode] = useState("gallery");
  const [files, setFiles] = useState([]);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  
  const [videos, setVideos] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [currentCategory, setCurrentCategory] = useState({ type: "all", tag: null });
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);

  const [selectedVideo, setSelectedVideo] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState([]); 
  const [editMemo, setEditMemo] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setInit(true);
    });
  }, []);

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

  // 1. 직접 파일 업로드
  const onFileUpload = async () => {
    if (files.length === 0) return alert("동영상을 선택해주세요!");
    setUploading(true);
    try {
      for (const file of files) {
        const filePath = `videos/${Date.now()}_${file.name}`;
        const fileRef = ref(storage, filePath);
        const result = await uploadBytes(fileRef, file);
        const url = await getDownloadURL(result.ref);
        
        await addDoc(collection(db, "videos"), {
          type: "direct",
          url,
          fileName: file.name,
          title: file.name.split('.')[0],
          filePath,
          createdAt: serverTimestamp(),
          tags: [],
          memo: ""
        });
      }
      setFiles([]); setViewMode("gallery");
    } catch (error) { alert("업로드 실패: " + error.message); }
    finally { setUploading(false); }
  };

  // 2. 유튜브 URL 등록
  const onYoutubeRegister = async () => {
    const videoId = getYoutubeId(youtubeUrl);
    if (!videoId) return alert("올바른 유튜브 주소를 입력해주세요!");
    
    setUploading(true);
    try {
      await addDoc(collection(db, "videos"), {
        type: "youtube",
        url: youtubeUrl,
        youtubeId: videoId,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        title: "새로운 유튜브 영상",
        createdAt: serverTimestamp(),
        tags: [],
        memo: ""
      });
      setYoutubeUrl("");
      setViewMode("gallery");
    } catch (e) { alert(e.message); }
    finally { setUploading(false); }
  };

  const onVideoClick = (vid) => {
    setSelectedVideo(vid);
    setEditTitle(vid.title || "");
    setEditTags(vid.tags || []);
    setEditMemo(vid.memo || "");
    setIsSheetOpen(false);
  };

  const onSaveDetails = async () => {
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "videos", selectedVideo.id), { 
        title: editTitle,
        tags: editTags, 
        memo: editMemo 
      });
      alert("저장되었습니다.");
      setIsSheetOpen(false);
    } catch (error) { alert(error.message); } 
    finally { setIsUpdating(false); }
  };

  const onDeleteClick = async () => {
    if (window.confirm("정말 삭제하시겠습니까?")) {
      try {
        await deleteDoc(doc(db, "videos", selectedVideo.id));
        if (selectedVideo.type === "direct") {
          await deleteObject(ref(storage, selectedVideo.filePath)).catch(e => console.log(e));
        }
        setSelectedVideo(null);
      } catch (error) { alert(error.message); }
    }
  };

  const filteredVideos = videos.filter((vid) => {
    let tagMatch = currentCategory.tag ? vid.tags?.includes(currentCategory.tag) : true;
    let searchMatch = searchKeyword ? (
      vid.memo?.toLowerCase().includes(searchKeyword.toLowerCase()) || 
      vid.title?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      vid.tags?.some(t => t.includes(searchKeyword))
    ) : true;
    return tagMatch && searchMatch;
  });

  if (!init) return <div style={{ padding: "20px", textAlign: "center", color: COLORS.coral }}>Loading...</div>;

  return (
    <div style={{ backgroundColor: "#e9ecef", minHeight: "100vh", display: "flex", justifyContent: "center", fontFamily: 'sans-serif' }}>
      <div style={{ width: "100%", maxWidth: "480px", backgroundColor: COLORS.bg, position: "relative", minHeight: "100vh", boxShadow: "0 0 20px rgba(0,0,0,0.1)", overflow: "hidden" }}>
        
        {isLoggedIn ? (
          <>
            <div style={{ padding: "30px 20px", paddingBottom: "100px", height: "100%", overflowY: "auto" }}>
              {viewMode === "gallery" ? (
                <div>
                  <h1 style={{ fontSize: "28px", fontWeight: "900", color: COLORS.text, marginBottom: "5px" }}>Archive.</h1>
                  <p style={{ color: COLORS.gray, fontSize: "14px", marginBottom: "20px" }}>{filteredVideos.length}개의 비디오 인스피레이션</p>
                  
                  <input type="text" placeholder="🔍 제목, 태그, 메모 검색" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} style={{ width: "100%", padding: "14px 20px", borderRadius: "20px", border: "none", backgroundColor: COLORS.lightGray, marginBottom: "20px", boxSizing: "border-box" }} />

                  <div style={{ columnCount: 2, columnGap: "15px" }}>
                    {filteredVideos.map((vid) => (
                      <div key={vid.id} onClick={() => onVideoClick(vid)} style={{ breakInside: "avoid", marginBottom: "15px", position: "relative", borderRadius: "16px", overflow: "hidden", cursor: "pointer", boxShadow: "0 4px 10px rgba(0,0,0,0.05)", backgroundColor: "#000" }}>
                        {vid.type === "youtube" ? (
                          <img src={vid.thumbnail} alt="thumb" style={{ width: "100%", display: "block" }} />
                        ) : (
                          <video src={vid.url} preload="metadata" style={{ width: "100%", display: "block" }} />
                        )}
                        <div style={{ position: "absolute", top: "10px", right: "10px", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: "50%", padding: "5px", color: "white" }}>
                          {vid.type === "youtube" ? "🎬" : "📱"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
                  <div>
                    <h2 style={{ color: COLORS.text, fontSize: "20px", marginBottom: "15px" }}>YouTube 링크 등록</h2>
                    <input type="text" placeholder="https://www.youtube.com/watch?v=..." value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} style={{ width: "100%", padding: "14px", borderRadius: "12px", border: `1px solid ${COLORS.lightGray}`, marginBottom: "10px", boxSizing: "border-box" }} />
                    <button onClick={onYoutubeRegister} disabled={uploading} style={{ width: "100%", padding: "14px", backgroundColor: COLORS.text, color: "white", border: "none", borderRadius: "12px", fontWeight: "bold" }}>링크 추가하기</button>
                  </div>
                  <div style={{ borderTop: "1px solid #eee", paddingTop: "20px" }}>
                    <h2 style={{ color: COLORS.text, fontSize: "20px", marginBottom: "15px" }}>직접 파일 업로드</h2>
                    <input type="file" accept="video/*" multiple onChange={(e) => setFiles(Array.from(e.target.files))} style={{ marginBottom: "10px" }} />
                    <button onClick={onFileUpload} disabled={uploading} style={{ width: "100%", padding: "14px", backgroundColor: COLORS.coral, color: "white", border: "none", borderRadius: "12px", fontWeight: "bold" }}>파일 업로드</button>
                  </div>
                  <button onClick={() => setViewMode("gallery")} style={{ background: "none", border: "none", color: COLORS.gray, fontWeight: "bold" }}>돌아가기</button>
                </div>
              )}
            </div>

            {/* 플로팅 메뉴 버튼 */}
            <button onClick={() => setIsMenuModalOpen(true)} style={{ position: "fixed", bottom: "30px", right: "max(30px, calc(50% - 210px))", width: "65px", height: "65px", backgroundColor: COLORS.coral, color: "white", border: "none", borderRadius: "50%", boxShadow: "0 8px 25px rgba(255,107,82,0.5)", zIndex: 900 }}>☰</button>

            {/* 메뉴 바텀 시트 */}
            <div style={{ position: "fixed", bottom: 0, left: 0, width: "100%", display: "flex", justifyContent: "center", zIndex: 1000, transition: "transform 0.3s", transform: isMenuModalOpen ? "translateY(0)" : "translateY(100%)", visibility: isMenuModalOpen ? "visible" : "hidden" }}>
              <div style={{ width: "100%", maxWidth: "480px", backgroundColor: "#fff", borderTopLeftRadius: "30px", borderTopRightRadius: "30px", padding: "30px", boxSizing: "border-box" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                  <h3 style={{ margin: 0 }}>Menu</h3>
                  <button onClick={() => setIsMenuModalOpen(false)} style={{ border: "none", background: "none", fontSize: "20px" }}>✕</button>
                </div>
                <button onClick={() => {setViewMode("upload"); setIsMenuModalOpen(false);}} style={{ width: "100%", padding: "15px", backgroundColor: COLORS.text, color: "white", borderRadius: "12px", border: "none", fontWeight: "bold", marginBottom: "10px" }}>새 영상 추가</button>
                <button onClick={() => signOut(auth)} style={{ width: "100%", padding: "15px", backgroundColor: COLORS.lightGray, color: COLORS.gray, borderRadius: "12px", border: "none", fontWeight: "bold" }}>로그아웃</button>
              </div>
            </div>
            {isMenuModalOpen && <div onClick={() => setIsMenuModalOpen(false)} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} />}

            {/* 비디오 상세 플레이어 & Overview */}
            {selectedVideo && (
              <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "black", zIndex: 2000, display: "flex", flexDirection: "column" }}>
                <div style={{ width: "100%", padding: "20px", display: "flex", justifyContent: "space-between", color: "white", zIndex: 2010 }}>
                  <h2 style={{ margin: 0, fontSize: "18px" }}>{selectedVideo.title || "제목 없음"}</h2>
                  <button onClick={() => setSelectedVideo(null)} style={{ background: "none", border: "none", color: "white", fontSize: "24px" }}>✕</button>
                </div>
                
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {selectedVideo.type === "youtube" ? (
                    <iframe width="100%" height="300" src={`https://www.youtube.com/embed/${selectedVideo.youtubeId}?autoplay=1`} frameBorder="0" allowFullScreen></iframe>
                  ) : (
                    <video src={selectedVideo.url} controls autoPlay style={{ width: "100%", maxHeight: "100%" }} />
                  )}
                </div>

                {!isSheetOpen && (
                  <div onClick={() => setIsSheetOpen(true)} style={{ padding: "30px", textAlign: "center", color: "white", cursor: "pointer" }}>Overview ▲</div>
                )}

                <div style={{ position: "absolute", bottom: 0, width: "100%", backgroundColor: "white", borderTopLeftRadius: "30px", borderTopRightRadius: "30px", padding: "30px", transition: "transform 0.4s", transform: isSheetOpen ? "translateY(0)" : "translateY(100%)", zIndex: 2006 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                    <span style={{ fontWeight: "bold" }}>상세 정보</span>
                    <button onClick={() => setIsSheetOpen(false)}>✕</button>
                  </div>
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="제목 입력" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #eee", marginBottom: "15px" }} />
                  <textarea value={editMemo} onChange={(e) => setEditMemo(e.target.value)} placeholder="메모 입력" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #eee", height: "80px", marginBottom: "15px" }} />
                  <button onClick={onSaveDetails} style={{ width: "100%", padding: "15px", backgroundColor: COLORS.text, color: "white", borderRadius: "12px", border: "none", fontWeight: "bold" }}>저장</button>
                  <button onClick={onDeleteClick} style={{ width: "100%", marginTop: "10px", color: "red", background: "none", border: "none" }}>삭제하기</button>
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
              <button type="submit" style={{ padding: "15px", backgroundColor: COLORS.coral, color: "#fff", border: "none", borderRadius: "10px", fontWeight: "bold" }}>{isNewAccount ? "가입하기" : "로그인"}</button>
            </form>
            <button onClick={() => setIsNewAccount(!isNewAccount)} style={{ marginTop: "20px", background: "none", border: "none", color: COLORS.gray }}>{isNewAccount ? "로그인하기" : "가입하기"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
