@extends('layouts.social')

@section('content')
<form class="composer" action="{{ route('post.store') }}" method="post" enctype="multipart/form-data">
  @csrf
  <h2>Compose</h2>
  <textarea name="body" rows="3" placeholder="Share something helpful… (max 2000)"></textarea>

  <div class="row">
    <label>Media file (image/video)</label>
    <input type="file" name="media" accept="image/*,video/*">
  </div>

  <div class="row">
    <label>Media type</label>
    <select name="media_type">
      <option value="none">None</option>
      <option value="image">Image</option>
      <option value="video">Video</option>
    </select>
  </div>

  <div class="row">
    <label>Visibility</label>
    <select name="visibility">
      <option value="public">Public</option>
      <option value="followers">Followers</option>
    </select>
  </div>

  <button class="btn btn-primary">Post</button>
</form>
@endsection
